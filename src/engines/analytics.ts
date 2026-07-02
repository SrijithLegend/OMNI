/**
 * Workspace Analytics Engine — Local-only tracking of user activity and workspace statistics.
 *
 * Tracks: Projects, Conversations, AI Usage, Switch Frequency, Tasks Completed, Searches, Exports.
 * All data stays local - nothing is sent to external services.
 */

import { BaseEngine } from "./base";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============== TYPES ==============

export type AnalyticsCategory =
  | "project"
  | "conversation"
  | "ai"
  | "task"
  | "search"
  | "export"
  | "import"
  | "system"
  | "workspace";

export type AnalyticsEventType =
  // Project events
  | "project_create"
  | "project_open"
  | "project_close"
  | "project_archive"
  | "project_restore"
  | "project_delete"
  // Conversation events
  | "conversation_create"
  | "conversation_open"
  | "conversation_archive"
  | "conversation_delete"
  // AI events
  | "ai_switch"
  | "ai_model_change"
  | "ai_prompt_send"
  | "ai_response_receive"
  // Task events
  | "task_create"
  | "task_complete"
  | "task_delete"
  | "task_status_change"
  // Search events
  | "search_performed"
  | "search_saved"
  | "search_used"
  // Export events
  | "export_start"
  | "export_complete"
  | "export_fail"
  // Import events
  | "import_start"
  | "import_complete"
  | "import_fail"
  // System events
  | "session_start"
  | "session_end"
  | "settings_change"
  | "shortcut_used";

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  eventCategory: AnalyticsCategory;
  projectId?: string;
  data: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

export interface AnalyticsSummary {
  period: "day" | "week" | "month";
  startDate: string;
  endDate: string;

  // Project metrics
  projectsCreated: number;
  projectsOpened: number;
  projectsArchived: number;
  activeProjects: number;

  // Conversation metrics
  conversationsCreated: number;
  totalMessages: number;
  avgMessagesPerConversation: number;

  // AI metrics
  aiSwitches: number;
  topModels: Array<{ model: string; count: number }>;
  avgResponseTime: number;

  // Task metrics
  tasksCreated: number;
  tasksCompleted: number;
  tasksDeleted: number;
  completionRate: number;

  // Search metrics
  searchesPerformed: number;
  topSearches: Array<{ query: string; count: number }>;

  // Export metrics
  exportsCompleted: number;
  topExportFormats: Array<{ format: string; count: number }>;

  // Usage metrics
  totalSessions: number;
  avgSessionDuration: number;
  mostActiveDay: string;
  mostActiveHour: number;
}

export interface WorkspaceStats {
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  favoriteProjects: number;

  totalConversations: number;
  totalMessages: number;

  totalFiles: number;
  totalFileSize: number;

  totalNotes: number;
  totalTasks: number;
  completedTasks: number;

  totalSnippets: number;
  totalClipboardItems: number;

  storageUsed: number;
  storageLimit: number;
}

// ============== ENGINE ==============

export class AnalyticsEngine extends BaseEngine {
  private supabase: SupabaseClient | null = null;
  private sessionId: string;
  private sessionStart: number;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents: AnalyticsEvent[] = [];

  constructor() {
    super({ name: "AnalyticsEngine", version: "1.0.0", debug: false });
    this.sessionId = crypto.randomUUID();
    this.sessionStart = Date.now();
  }

  async start(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // Track session start
    await this.track("session_start", "system");

    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    // Track session end
    await this.track("session_end", "system", undefined, {
      duration_ms: Date.now() - this.sessionStart,
    });

    await this.flushEvents();
    this.isRunning = false;
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    return {
      ok: true,
      message: `Analytics: ${this.pendingEvents.length} pending events`,
      timestamp: Date.now(),
    };
  }

  // ============== TRACKING ==============

  /**
   * Track an analytics event
   */
  async track(
    eventType: AnalyticsEventType,
    eventCategory: AnalyticsCategory,
    projectId?: string,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    const event: AnalyticsEvent = {
      id: crypto.randomUUID(),
      eventType,
      eventCategory,
      projectId,
      data,
      sessionId: this.sessionId,
      timestamp: Date.now(),
    };

    this.pendingEvents.push(event);
    this.eventQueue.push(event);

    // Debounced flush
    this.debouncedFlush();

    this.emit("tracked", event);
  }

  /**
   * Track with timing (for measuring durations)
   */
  async trackTimed<T>(
    eventType: AnalyticsEventType,
    eventCategory: AnalyticsCategory,
    projectId: string | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      await this.track(eventType, eventCategory, projectId, { duration_ms: duration, success: true });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      await this.track(eventType, eventCategory, projectId, {
        duration_ms: duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Track a shortcut usage
   */
  async trackShortcut(shortcutId: string, context?: string): Promise<void> {
    await this.track("shortcut_used", "system", undefined, {
      shortcut_id: shortcutId,
      context,
    });
  }

  /**
   * Track a search query
   */
  async trackSearch(query: string, resultCount: number, hasResults: boolean): Promise<void> {
    await this.track("search_performed", "search", undefined, {
      query_length: query.length,
      result_count: resultCount,
      has_results: hasResults,
    });
  }

  /**
   * Track an export operation
   */
  async trackExport(format: string, scope: string, itemCount: number, durationMs: number): Promise<void> {
    await this.track("export_complete", "export", undefined, {
      format,
      scope,
      item_count: itemCount,
      duration_ms: durationMs,
    });
  }

  /**
   * Track an AI model switch
   */
  async trackAISwitch(fromModel: string | null, toModel: string, projectId?: string): Promise<void> {
    await this.track("ai_switch", "ai", projectId, {
      from_model: fromModel,
      to_model: toModel,
    });
  }

  /**
   * Track a task completion
   */
  async trackTaskCompletion(taskId: string, projectId: string, timeToComplete?: number): Promise<void> {
    await this.track("task_complete", "task", projectId, {
      task_id: taskId,
      time_to_complete_ms: timeToComplete,
    });
  }

  // ============== QUERIES ==============

  /**
   * Get analytics summary for a time period
   */
  async getSummary(period: "day" | "week" | "month" = "week"): Promise<AnalyticsSummary> {
    const now = new Date();
    const startDate = this.getPeriodStart(now, period);
    const endDate = now.toISOString().split("T")[0];

    const summary: AnalyticsSummary = {
      period,
      startDate,
      endDate,
      projectsCreated: 0,
      projectsOpened: 0,
      projectsArchived: 0,
      activeProjects: 0,
      conversationsCreated: 0,
      totalMessages: 0,
      avgMessagesPerConversation: 0,
      aiSwitches: 0,
      topModels: [],
      avgResponseTime: 0,
      tasksCreated: 0,
      tasksCompleted: 0,
      tasksDeleted: 0,
      completionRate: 0,
      searchesPerformed: 0,
      topSearches: [],
      exportsCompleted: 0,
      topExportFormats: [],
      totalSessions: 0,
      avgSessionDuration: 0,
      mostActiveDay: "",
      mostActiveHour: 0,
    };

    if (!this.supabase) return summary;

    const { data, error } = await this.supabase
      .from("omni_analytics_events")
      .select("*")
      .gte("day_bucket", startDate)
      .lte("day_bucket", endDate);

    if (error || !data) return summary;

    // Aggregate data
    for (const row of data) {
      const type = row.event_type as AnalyticsEventType;
      const category = row.event_category as AnalyticsCategory;
      const rowData = row.data as Record<string, unknown> || {};

      switch (type) {
        case "project_create":
          summary.projectsCreated++;
          break;
        case "project_open":
          summary.projectsOpened++;
          break;
        case "project_archive":
          summary.projectsArchived++;
          break;
        case "conversation_create":
          summary.conversationsCreated++;
          break;
        case "ai_switch":
          summary.aiSwitches++;
          break;
        case "task_create":
          summary.tasksCreated++;
          break;
        case "task_complete":
          summary.tasksCompleted++;
          break;
        case "search_performed":
          summary.searchesPerformed++;
          if (typeof rowData.query === "string") {
            // Track top searches
          }
          break;
        case "export_complete":
          summary.exportsCompleted++;
          break;
        case "session_start":
          summary.totalSessions++;
          break;
      }
    }

    // Calculate derived metrics
    if (summary.tasksCreated > 0) {
      summary.completionRate = (summary.tasksCompleted / summary.tasksCreated) * 100;
    }

    return summary;
  }

  /**
   * Get current workspace statistics
   */
  async getWorkspaceStats(): Promise<WorkspaceStats> {
    const stats: WorkspaceStats = {
      totalProjects: 0,
      activeProjects: 0,
      archivedProjects: 0,
      favoriteProjects: 0,
      totalConversations: 0,
      totalMessages: 0,
      totalFiles: 0,
      totalFileSize: 0,
      totalNotes: 0,
      totalTasks: 0,
      completedTasks: 0,
      totalSnippets: 0,
      totalClipboardItems: 0,
      storageUsed: 0,
      storageLimit: 50 * 1024 * 1024 * 1024, // 50MB default limit
    };

    if (!this.supabase) return stats;

    // Get project counts
    const { count: projectCount } = await this.supabase
      .from("omni_projects")
      .select("*", { count: "exact", head: true });

    stats.totalProjects = projectCount || 0;

    // Get active projects count
    const { count: activeCount } = await this.supabase
      .from("omni_projects")
      .select("*", { count: "exact", head: true })
      .eq("is_archived", false);

    stats.activeProjects = activeCount || 0;

    // Get archived projects
    const { count: archivedCount } = await this.supabase
      .from("omni_projects")
      .select("*", { count: "exact", head: true })
      .eq("is_archived", true);

    stats.archivedProjects = archivedCount || 0;

    // Get favorite projects
    const { count: favoriteCount } = await this.supabase
      .from("omni_projects")
      .select("*", { count: "exact", head: true })
      .eq("is_favorite", true);

    stats.favoriteProjects = favoriteCount || 0;

    // Get conversation counts
    const { count: conversationCount } = await this.supabase
      .from("omni_conversations")
      .select("*", { count: "exact", head: true });

    stats.totalConversations = conversationCount || 0;

    // Get message count
    const { count: messageCount } = await this.supabase
      .from("omni_messages")
      .select("*", { count: "exact", head: true });

    stats.totalMessages = messageCount || 0;

    // Get file counts
    const { data: fileData } = await this.supabase
      .from("omni_files")
      .select("size")
      .eq("is_deleted", false);

    stats.totalFiles = fileData?.length || 0;
    stats.totalFileSize = fileData?.reduce((sum, f) => sum + (f.size || 0), 0) || 0;

    // Get note count
    const { count: noteCount } = await this.supabase
      .from("omni_notes")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false);

    stats.totalNotes = noteCount || 0;

    // Get task counts
    const { count: taskCount } = await this.supabase
      .from("omni_tasks")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false);

    stats.totalTasks = taskCount || 0;

    const { count: completedTaskCount } = await this.supabase
      .from("omni_tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "done");

    stats.completedTasks = completedTaskCount || 0;

    // Get snippet count
    const { count: snippetCount } = await this.supabase
      .from("omni_snippets")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false);

    stats.totalSnippets = snippetCount || 0;

    // Get clipboard count
    const { count: clipboardCount } = await this.supabase
      .from("omni_clipboard_items")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false);

    stats.totalClipboardItems = clipboardCount || 0;

    // Calculate total storage used
    stats.storageUsed = stats.totalFileSize + (stats.totalNotes * 1024) + (stats.totalClipboardItems * 512);

    return stats;
  }

  /**
   * Get event counts by type for a period
   */
  async getEventCounts(eventType?: AnalyticsEventType, days = 7): Promise<Array<{ date: string; count: number }>> {
    if (!this.supabase) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = this.supabase
      .from("omni_analytics_events")
      .select("day_bucket")
      .gte("day_bucket", startDate.toISOString().split("T")[0]);

    if (eventType) {
      query = query.eq("event_type", eventType);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    // Aggregate by date
    const counts = new Map<string, number>();
    for (const row of data) {
      const date = row.day_bucket as string;
      counts.set(date, (counts.get(date) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get most used AI models
   */
  async getTopModels(days = 30): Promise<Array<{ model: string; count: number }>> {
    if (!this.supabase) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from("omni_analytics_events")
      .select("data")
      .eq("event_type", "ai_switch")
      .gte("day_bucket", startDate.toISOString().split("T")[0]);

    if (error || !data) return [];

    // Count model usage
    const modelCounts = new Map<string, number>();
    for (const row of data) {
      const rowData = row.data as Record<string, unknown>;
      const model = rowData.to_model as string;
      if (model) {
        modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
      }
    }

    return Array.from(modelCounts.entries())
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Clear all analytics data
   */
  async clearData(): Promise<void> {
    if (this.supabase) {
      await this.supabase.from("omni_analytics_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }
    this.pendingEvents = [];
    this.eventQueue = [];
    this.emit("data-cleared");
  }

  // ============== INTERNAL ==============

  private getPeriodStart(now: Date, period: "day" | "week" | "month"): string {
    const start = new Date(now);

    switch (period) {
      case "day":
        start.setDate(start.getDate() - 1);
        break;
      case "week":
        start.setDate(start.getDate() - 7);
        break;
      case "month":
        start.setMonth(start.getMonth() - 1);
        break;
    }

    return start.toISOString().split("T")[0];
  }

  private debouncedFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flushEvents();
    }, 500);
  }

  private async flushEvents(): Promise<void> {
    if (this.pendingEvents.length === 0) return;

    const batch = this.pendingEvents.splice(0, this.pendingEvents.length);

    if (this.supabase) {
      const rows = batch.map((event) => ({
        id: event.id,
        event_type: event.eventType,
        event_category: event.eventCategory,
        project_id: event.projectId,
        data: event.data,
        session_id: event.sessionId,
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const { error } = await this.supabase.from("omni_analytics_events").insert(chunk);

        if (error) {
          this.log("error", "Failed to save analytics events", error);
        }
      }
    }
  }
}

// ============== SINGLETON ==============

let _instance: AnalyticsEngine | null = null;

export function getAnalyticsEngine(): AnalyticsEngine {
  if (!_instance) {
    _instance = new AnalyticsEngine();
  }
  return _instance;
}
