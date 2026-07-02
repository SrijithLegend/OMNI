/**
 * Backup Engine — Create and restore workspace backups.
 *
 * Features: Automatic backups, Manual backups, Versioned backups, Selective restore
 */

import { BaseEngine } from "./base";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getAuthEngine } from "./auth";

// ============== TYPES ==============

export type BackupType = "automatic" | "manual" | "scheduled";

export type BackupScope = "workspace" | "project" | "settings";

export type BackupStatus = "pending" | "processing" | "completed" | "failed" | "expired";

export interface BackupJob {
  id: string;
  userId: string;
  backupType: BackupType;
  backupScope: BackupScope;
  storagePath?: string;
  storageSize: number;
  compressionType: string;
  encrypted: boolean;
  projectCount: number;
  conversationCount: number;
  noteCount: number;
  taskCount: number;
  fileCount: number;
  status: BackupStatus;
  progress: number;
  errorMessage?: string;
  expiresAt?: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  backupType: BackupType;
  backupScope: BackupScope;
  projects: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  files: Record<string, unknown>[];
  notes: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  snippets: Record<string, unknown>[];
  clipboard: Record<string, unknown>[];
  timeline: Record<string, unknown>[];
  settings: Record<string, unknown>;
  metadata: {
    projectCount: number;
    conversationCount: number;
    noteCount: number;
    taskCount: number;
    fileCount: number;
    snippetCount: number;
    clipboardCount: number;
    timelineCount: number;
  };
}

export interface RestoreOptions {
  backupId: string;
  restoreScope: ("projects" | "conversations" | "notes" | "tasks" | "files" | "snippets" | "clipboard" | "timeline" | "settings")[];
  overwrite: boolean;
  mergeStrategy: "replace" | "skip_existing" | "merge";
}

export interface RestoreProgress {
  phase: "idle" | "downloading" | "extracting" | "restoring" | "complete" | "error";
  total: number;
  restored: number;
  skipped: number;
  errors: string[];
  current?: string;
}

// ============== ENGINE ==============

export class BackupEngine extends BaseEngine {
  private supabase: SupabaseClient | null = null;
  private userId: string | null = null;
  private backupTimer: ReturnType<typeof setInterval> | null = null;
  private processing: boolean = false;

  constructor() {
    super({ name: "BackupEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    const authEngine = getAuthEngine();
    const user = authEngine.getCurrentUser();
    if (user) {
      this.userId = user.id;
      this.setupAutomaticBackups();
    }

    authEngine.onAuthStateChange((event) => {
      if (event.user) {
        this.userId = event.user.id;
        this.setupAutomaticBackups();
      } else {
        this.userId = null;
        this.stopAutomaticBackups();
      }
    });

    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.stopAutomaticBackups();
    this.isRunning = false;
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    const backups = await this.listBackups(1, 1);
    return {
      ok: true,
      message: `Backup: ${backups.total} backups available`,
      timestamp: Date.now(),
    };
  }

  // ============== BACKUP CREATION ==============

  /**
   * Create a backup
   */
  async createBackup(
    backupType: BackupType = "manual",
    backupScope: BackupScope = "workspace",
    onProgress?: (progress: number) => void
  ): Promise<BackupJob> {
    if (!this.supabase || !this.userId) {
      throw new Error("Not authenticated");
    }

    if (this.processing) {
      throw new Error("Another backup is in progress");
    }

    this.processing = true;

    const job = await this.createBackupJob(backupType, backupScope);

    try {
      // Step 1: Collect all data
      const backupData = await this.collectBackupData(backupScope, (p) => onProgress?.(p / 2));

      // Step 2: Serialize and compress
      const backupJson = JSON.stringify(backupData);
      const compressed = await this.compressData(backupJson);
      onProgress?.(75);

      // Step 3: Upload to storage
      const storagePath = await this.uploadBackup(job.id, compressed);

      // Step 4: Update backup job
      await this.updateBackupJob(job.id, {
        status: "completed",
        progress: 100,
        storagePath,
        storageSize: compressed.size,
        projectCount: backupData.metadata.projectCount,
        conversationCount: backupData.metadata.conversationCount,
        noteCount: backupData.metadata.noteCount,
        taskCount: backupData.metadata.taskCount,
        fileCount: backupData.metadata.fileCount,
        completedAt: Date.now(),
      });

      onProgress?.(100);
      this.emit("backup-completed", job);
    } catch (error) {
      await this.updateBackupJob(job.id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Backup failed",
      });
      this.emit("backup-failed", error);
      throw error;
    } finally {
      this.processing = false;
    }

    return job;
  }

  /**
   * Create scheduled automatic backup
   */
  async createAutomaticBackup(): Promise<void> {
    if (!this.userId) return;

    try {
      await this.createBackup("automatic", "workspace");
    } catch (error) {
      this.log("error", "Automatic backup failed", error);
    }
  }

  // ============== BACKUP RETRIEVAL ==============

  /**
   * List available backups
   */
  async listBackups(page = 1, limit = 20): Promise<{ backups: BackupJob[]; total: number }> {
    if (!this.supabase || !this.userId) {
      return { backups: [], total: 0 };
    }

    const offset = (page - 1) * limit;

    const [{ data, error }, { count }] = await Promise.all([
      this.supabase
        .from("omni_user_backups")
        .select("*")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      this.supabase
        .from("omni_user_backups")
        .select("*", { count: "exact", head: true })
        .eq("user_id", this.userId),
    ]);

    if (error || !data) {
      return { backups: [], total: 0 };
    }

    return {
      backups: data.map(this.mapBackupJob),
      total: count || 0,
    };
  }

  /**
   * Get a specific backup
   */
  async getBackup(backupId: string): Promise<BackupJob | null> {
    if (!this.supabase || !this.userId) return null;

    const { data, error } = await this.supabase
      .from("omni_user_backups")
      .select("*")
      .eq("id", backupId)
      .eq("user_id", this.userId)
      .single();

    if (error || !data) return null;

    return this.mapBackupJob(data);
  }

  /**
   * Get backup data
   */
  async getBackupData(backupId: string): Promise<BackupData | null> {
    if (!this.supabase || !this.userId) return null;

    const backup = await this.getBackup(backupId);
    if (!backup || !backup.storagePath) return null;

    // Download from storage
    const compressed = await this.downloadBackup(backup.storagePath);
    if (!compressed) return null;

    // Decompress and parse
    const json = await this.decompressData(compressed);
    return JSON.parse(json) as BackupData;
  }

  // ============== RESTORE ==============

  /**
   * Restore from a backup
   */
  async restoreBackup(
    options: RestoreOptions,
    onProgress?: (progress: RestoreProgress) => void
  ): Promise<RestoreProgress> {
    if (!this.supabase || !this.userId) {
      throw new Error("Not authenticated");
    }

    const progress: RestoreProgress = {
      phase: "idle",
      total: 0,
      restored: 0,
      skipped: 0,
      errors: [],
    };

    if (this.processing) {
      throw new Error("Another operation is in progress");
    }

    this.processing = true;

    try {
      // Step 1: Download backup
      progress.phase = "downloading";
      onProgress?.(progress);

      const backupData = await this.getBackupData(options.backupId);
      if (!backupData) {
        throw new Error("Backup not found or corrupted");
      }

      // Step 2: Restore selected scopes
      progress.phase = "restoring";
      progress.total = options.restoreScope.reduce((sum, scope) => {
        const dataMap: Record<string, Record<string, unknown>[]> = {
          projects: backupData.projects,
          conversations: backupData.conversations,
          notes: backupData.notes,
          tasks: backupData.tasks,
          files: backupData.files,
          snippets: backupData.snippets,
          clipboard: backupData.clipboard,
          timeline: backupData.timeline,
          settings: [backupData.settings],
        };
        return sum + (dataMap[scope]?.length || 0);
      }, 0);

      onProgress?.(progress);

      for (const scope of options.restoreScope) {
        await this.restoreScope(scope, backupData, options, progress);
        onProgress?.(progress);
      }

      progress.phase = "complete";
      this.emit("restore-completed", options.backupId);
    } catch (error) {
      progress.phase = "error";
      progress.errors.push(error instanceof Error ? error.message : "Restore failed");
      this.emit("restore-failed", error);
    } finally {
      this.processing = false;
    }

    return progress;
  }

  private async restoreScope(
    scope: string,
    backupData: BackupData,
    options: RestoreOptions,
    progress: RestoreProgress
  ): Promise<void> {
    const dataMap: Record<string, { data: Record<string, unknown>[]; table: string }> = {
      projects: { data: backupData.projects, table: "omni_projects" },
      conversations: { data: backupData.conversations, table: "omni_conversations" },
      notes: { data: backupData.notes, table: "omni_notes" },
      tasks: { data: backupData.tasks, table: "omni_tasks" },
      files: { data: backupData.files, table: "omni_files" },
      snippets: { data: backupData.snippets, table: "omni_snippets" },
      clipboard: { data: backupData.clipboard, table: "omni_clipboard_items" },
      timeline: { data: backupData.timeline, table: "omni_timeline_events" },
      settings: { data: [backupData.settings], table: "omni_user_profiles" },
    };

    const { data, table } = dataMap[scope] || { data: [], table: "" };
    if (!this.supabase || data.length === 0) return;

    for (const item of data) {
      progress.current = scope;
      try {
        // Check if exists
        if (!options.overwrite) {
          const { data: existing } = await this.supabase
            .from(table)
            .select("id")
            .eq("id", item.id)
            .single();

          if (existing) {
            if (options.mergeStrategy === "skip_existing") {
              progress.skipped++;
              continue;
            } else if (options.mergeStrategy === "merge") {
              // Merge data (existing takes precedence)
              continue;
            }
          }
        }

        // Upsert the item
        const record = {
          ...item,
          user_id: this.userId,
          restored_at: new Date().toISOString(),
        };

        const { error } = await this.supabase.from(table).upsert(record, { onConflict: "id" });

        if (error) {
          progress.errors.push(`${scope}.${item.id}: ${error.message}`);
        } else {
          progress.restored++;
        }
      } catch (error) {
        progress.errors.push(`${scope}.${item.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  // ============== BACKUP MANAGEMENT ==============

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    if (!this.supabase || !this.userId) return;

    // Get backup info first
    const { data: backup } = await this.supabase
      .from("omni_user_backups")
      .select("storage_path")
      .eq("id", backupId)
      .eq("user_id", this.userId)
      .single();

    if (backup?.storage_path) {
      // Delete from storage
      await this.supabase.storage.from("backups").remove([backup.storage_path]);
    }

    // Delete record
    await this.supabase.from("omni_user_backups").delete().eq("id", backupId);

    this.emit("backup-deleted", backupId);
  }

  /**
   * Download backup as file
   */
  async downloadBackupFile(backupId: string): Promise<void> {
    const backupData = await this.getBackupData(backupId);
    if (!backupData) {
      throw new Error("Backup not found");
    }

    const json = JSON.stringify(backupData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `omni-backup-${backupId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============== INTERNAL ==============

  private async createBackupJob(backupType: BackupType, backupScope: BackupScope): Promise<BackupJob> {
    if (!this.supabase || !this.userId) {
      throw new Error("Not authenticated");
    }

    const id = crypto.randomUUID();
    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000; // 90 days

    await this.supabase.from("omni_user_backups").insert({
      id,
      user_id: this.userId,
      backup_type: backupType,
      backup_scope: backupScope,
      status: "pending",
      progress: 0,
      encryption_type: "gzip",
      encrypted: true,
      expires_at: new Date(expiresAt).toISOString(),
    });

    return {
      id,
      userId: this.userId,
      backupType,
      backupScope,
      storageSize: 0,
      compressionType: "gzip",
      encrypted: true,
      projectCount: 0,
      conversationCount: 0,
      noteCount: 0,
      taskCount: 0,
      fileCount: 0,
      status: "pending",
      progress: 0,
      expiresAt,
      createdAt: Date.now(),
    };
  }

  private async updateBackupJob(backupId: string, updates: Partial<BackupJob>): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from("omni_user_backups")
      .update({
        status: updates.status,
        progress: updates.progress,
        storage_path: updates.storagePath,
        storage_size_bytes: updates.storageSize,
        project_count: updates.projectCount,
        conversation_count: updates.conversationCount,
        note_count: updates.noteCount,
        task_count: updates.taskCount,
        file_count: updates.fileCount,
        error_message: updates.errorMessage,
        completed_at: updates.completedAt ? new Date(updates.completedAt).toISOString() : null,
        started_at: updates.startedAt ? new Date(updates.startedAt).toISOString() : null,
      })
      .eq("id", backupId);
  }

  private async collectBackupData(
    backupScope: BackupScope,
    onProgress?: (progress: number) => void
  ): Promise<BackupData> {
    if (!this.supabase || !this.userId) {
      throw new Error("Not authenticated");
    }

    const backupData: BackupData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      backupType: "manual",
      backupScope,
      projects: [],
      conversations: [],
      messages: [],
      files: [],
      notes: [],
      tasks: [],
      snippets: [],
      clipboard: [],
      timeline: [],
      settings: {},
      metadata: {
        projectCount: 0,
        conversationCount: 0,
        noteCount: 0,
        taskCount: 0,
        fileCount: 0,
        snippetCount: 0,
        clipboardCount: 0,
        timelineCount: 0,
      },
    };

    // Collect projects
    const { data: projects } = await this.supabase
      .from("omni_projects")
      .select("*")
      .eq("user_id", this.userId);
    backupData.projects = projects || [];
    backupData.metadata.projectCount = backupData.projects.length;
    onProgress?.(10);

    // Collect conversations
    const { data: conversations } = await this.supabase
      .from("omni_conversations")
      .select("*")
      .eq("user_id", this.userId);
    backupData.conversations = conversations || [];
    backupData.metadata.conversationCount = backupData.conversations.length;

    // Collect messages for each conversation
    if (backupData.conversations.length > 0) {
      const convIds = backupData.conversations.map((c) => c.id);
      const { data: messages } = await this.supabase
        .from("omni_messages")
        .select("*")
        .in("conversation_id", convIds);
      backupData.messages = messages || [];
    }
    onProgress?.(20);

    // Collect notes
    const { data: notes } = await this.supabase
      .from("omni_notes")
      .select("*")
      .eq("user_id", this.userId);
    backupData.notes = notes || [];
    backupData.metadata.noteCount = backupData.notes.length;
    onProgress?.(30);

    // Collect tasks
    const { data: tasks } = await this.supabase
      .from("omni_tasks")
      .select("*")
      .eq("user_id", this.userId);
    backupData.tasks = tasks || [];
    backupData.metadata.taskCount = backupData.tasks.length;
    onProgress?.(40);

    // Collect files
    const { data: files } = await this.supabase
      .from("omni_files")
      .select("*")
      .eq("user_id", this.userId);
    backupData.files = files || [];
    backupData.metadata.fileCount = backupData.files.length;
    onProgress?.(50);

    // Collect snippets
    const { data: snippets } = await this.supabase
      .from("omni_snippets")
      .select("*")
      .eq("user_id", this.userId);
    backupData.snippets = snippets || [];
    backupData.metadata.snippetCount = backupData.snippets.length;
    onProgress?.(60);

    // Collect clipboard
    const { data: clipboard } = await this.supabase
      .from("omni_clipboard_items")
      .select("*")
      .eq("user_id", this.userId);
    backupData.clipboard = clipboard || [];
    backupData.metadata.clipboardCount = backupData.clipboard.length;
    onProgress?.(70);

    // Collect timeline
    const { data: timeline } = await this.supabase
      .from("omni_timeline_events")
      .select("*")
      .eq("user_id", this.userId)
      .limit(1000);
    backupData.timeline = timeline || [];
    backupData.metadata.timelineCount = backupData.timeline.length;

    // Collect settings
    const { data: settings } = await this.supabase
      .from("omni_user_profiles")
      .select("*")
      .eq("user_id", this.userId)
      .single();
    backupData.settings = settings || {};

    return backupData;
  }

  private async compressData(data: string): Promise<Blob> {
    // Use CompressionStream if available (modern browsers)
    if ("CompressionStream" in window) {
      const stream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
      });

      const writer = stream.writable.getWriter();
      writer.write(new TextEncoder().encode(data));
      writer.close();

      const compressedStream = stream.readable.pipeThrough(
        new CompressionStream("gzip")
      );

      const reader = compressedStream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      return new Blob(chunks as BlobPart[]);
    }

    // Fallback: no compression
    return new Blob([data], { type: "application/json" });
  }

  private async decompressData(data: Blob): Promise<string> {
    // Use DecompressionStream if available
    if ("DecompressionStream" in window) {
      const stream = data.stream().pipeThrough(new DecompressionStream("gzip"));
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const combined = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      return new TextDecoder().decode(combined);
    }

    // Fallback: assume uncompressed
    return await data.text();
  }

  private async uploadBackup(backupId: string, data: Blob): Promise<string> {
    if (!this.supabase || !this.userId) return "";

    const path = `${this.userId}/${backupId}.json.gz`;

    const { error } = await this.supabase.storage
      .from("backups")
      .upload(path, data, {
        contentType: "application/gzip",
        upsert: true,
      });

    if (error) {
      throw error;
    }

    return path;
  }

  private async downloadBackup(storagePath: string): Promise<Blob | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase.storage
      .from("backups")
      .download(storagePath);

    if (error || !data) return null;

    return data;
  }

  private mapBackupJob(data: Record<string, unknown>): BackupJob {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      backupType: data.backup_type as BackupType,
      backupScope: data.backup_scope as BackupScope,
      storagePath: data.storage_path as string | undefined,
      storageSize: (data.storage_size_bytes as number) || 0,
      compressionType: (data.compression_type as string) || "gzip",
      encrypted: data.encrypted as boolean,
      projectCount: (data.project_count as number) || 0,
      conversationCount: (data.conversation_count as number) || 0,
      noteCount: (data.note_count as number) || 0,
      taskCount: (data.task_count as number) || 0,
      fileCount: (data.file_count as number) || 0,
      status: data.status as BackupStatus,
      progress: (data.progress as number) || 0,
      errorMessage: data.error_message as string | undefined,
      expiresAt: data.expires_at ? new Date(data.expires_at as string).getTime() : undefined,
      createdAt: new Date(data.created_at as string).getTime(),
      startedAt: data.started_at ? new Date(data.started_at as string).getTime() : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at as string).getTime() : undefined,
    };
  }

  private setupAutomaticBackups(): void {
    // Create automatic backup every 24 hours
    this.backupTimer = setInterval(() => {
      this.createAutomaticBackup();
    }, 24 * 60 * 60 * 1000);
  }

  private stopAutomaticBackups(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }
}

// ============== SINGLETON ==============

let _instance: BackupEngine | null = null;

export function getBackupEngine(): BackupEngine {
  if (!_instance) {
    _instance = new BackupEngine();
  }
  return _instance;
}
