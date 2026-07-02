/**
 * Universal Search Engine — Full-text search with fuzzy matching, prefix matching, and background indexing.
 *
 * Searchable: Projects, Conversations, Messages, Files, Notes, Tasks, Snippets, Clipboard, Timeline, Pinned Items.
 */

import { BaseEngine, getEngine } from "./base";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============== TYPES ==============

export type SearchableType =
  | "project"
  | "conversation"
  | "message"
  | "file"
  | "note"
  | "task"
  | "snippet"
  | "clipboard"
  | "timeline"
  | "pinned";

export interface SearchEntry {
  id: string;
  type: SearchableType;
  itemId: string;
  projectId: string | null;
  title: string;
  content: string;
  preview: string;
  metadata: Record<string, unknown>;
  score: number;
  accessCount: number;
  timestamp: number;
}

export interface SearchQuery {
  q: string;
  types?: SearchableType[];
  projectId?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
  prefix?: boolean;
  highlight?: boolean;
}

export interface SearchResult {
  entries: SearchEntry[];
  total: number;
  query: string;
  duration: number;
  suggestions: string[];
  groups?: Map<SearchableType, SearchEntry[]>;
}

export interface SearchFilter {
  projects?: string[];
  tags?: string[];
  status?: string[];
  priority?: string[];
  dateRange?: { from: number; to: number };
}

export interface IndexProgress {
  phase: "idle" | "indexing" | "complete" | "error";
  total: number;
  indexed: number;
  currentType?: SearchableType;
  errors: string[];
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilter;
  sortBy: "relevance" | "date" | "name";
  sortOrder: "asc" | "desc";
  useCount: number;
  lastUsedAt: number | null;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

// ============== UTILITY FUNCTIONS ==============

/**
 * Simple fuzzy match using Levenshtein distance approximation
 */
function fuzzyMatch(pattern: string, text: string): boolean {
  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact substring match
  if (textLower.includes(patternLower)) return true;

  // Check for prefix match
  if (textLower.startsWith(patternLower)) return true;

  // Simple fuzzy: pattern characters must appear in order in text
  let patternIndex = 0;
  for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
    if (textLower[i] === patternLower[patternIndex]) {
      patternIndex++;
    }
  }

  return patternIndex === patternLower.length;
}

/**
 * Calculate relevance score for a search result
 */
function calculateScore(entry: SearchEntry, query: string, fuzzy: boolean): number {
  const q = query.toLowerCase();
  const titleLower = entry.title.toLowerCase();
  const contentLower = entry.content.toLowerCase();

  let score = entry.score + entry.accessCount * 0.1;

  // Exact title match (highest)
  if (titleLower === q) {
    score += 100;
  }
  // Title starts with query
  else if (titleLower.startsWith(q)) {
    score += 80;
  }
  // Title contains query
  else if (titleLower.includes(q)) {
    score += 60;
  }
  // Content starts with query
  else if (contentLower.startsWith(q)) {
    score += 40;
  }
  // Content contains query
  else if (contentLower.includes(q)) {
    score += 20;
  }
  // Fuzzy match
  else if (fuzzy && fuzzyMatch(q, titleLower)) {
    score += 10;
  }

  // Boost for recent items
  const ageMs = Date.now() - entry.timestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  score += Math.max(0, 10 - ageDays);

  return score;
}

/**
 * Highlight matching text in a string
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text;

  const q = query.toLowerCase();
  const textLower = text.toLowerCase();
  let index = textLower.indexOf(q);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + q.length);
  const after = highlightMatch(text.slice(index + q.length), query);

  return `${before}<mark class="bg-yellow-200 dark:bg-yellow-800">${match}</mark>${after}`;
}

/**
 * Generate search suggestions based on partial query
 */
function generateSuggestions(entries: SearchEntry[], query: string): string[] {
  const q = query.toLowerCase();
  if (q.length < 2) return [];

  const suggestions = new Set<string>();

  for (const entry of entries) {
    const titleLower = entry.title.toLowerCase();

    // Add title if it starts with query
    if (titleLower.startsWith(q) && titleLower !== q) {
      suggestions.add(entry.title);
    }

    // Check for words starting with query
    const words = titleLower.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(q) && word !== q && suggestions.size < 10) {
        suggestions.add(word.charAt(0).toUpperCase() + word.slice(1));
      }
    }
  }

  return Array.from(suggestions).slice(0, 5);
}

// ============== MAIN ENGINE ==============

export class SearchEngine extends BaseEngine {
  private supabase: SupabaseClient | null = null;
  private localIndex: Map<string, SearchEntry> = new Map();
  private pendingIndex: SearchEntry[] = [];
  private indexTimer: ReturnType<typeof setTimeout> | null = null;
  private progressCallback: ((progress: IndexProgress) => void) | null = null;
  private progress: IndexProgress = { phase: "idle", total: 0, indexed: 0, errors: [] };

  constructor() {
    super({ name: "SearchEngine", version: "1.0.0", debug: false });
    this.dependsOn("ProjectEngine");
  }

  async start(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.cancelPendingIndex();
    await this.savePendingIndex();
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    const stats = await this.getStats();
    return {
      ok: true,
      message: `Search: ${stats.total} entries indexed`,
      timestamp: Date.now(),
    };
  }

  // ============== INDEXING ==============

  /**
   * Index a single entry (non-blocking, debounced)
   */
  async indexEntry(entry: SearchEntry): Promise<void> {
    this.localIndex.set(entry.id, entry);
    this.pendingIndex.push(entry);

    if (this.pendingIndex.length >= 50) {
      await this.savePendingIndex();
    } else {
      this.debouncedSave();
    }

    this.emit("indexed", entry);
  }

  /**
   * Index multiple entries in a batch
   */
  async indexBatch(entries: SearchEntry[]): Promise<void> {
    for (const entry of entries) {
      this.localIndex.set(entry.id, entry);
    }

    this.pendingIndex.push(...entries);

    if (this.pendingIndex.length >= 50) {
      await this.savePendingIndex();
    } else {
      this.debouncedSave();
    }

    this.emit("indexed-batch", { count: entries.length });
  }

  /**
   * Remove an entry from the index
   */
  async removeEntry(id: string): Promise<void> {
    this.localIndex.delete(id);

    if (this.supabase) {
      await this.supabase.from("omni_search_index").delete().eq("id", id);
    }

    this.emit("removed", id);
  }

  /**
   * Rebuild the entire index
   */
  async rebuildIndex(onProgress?: (progress: IndexProgress) => void): Promise<void> {
    this.progressCallback = onProgress || null;
    this.progress = { phase: "indexing", total: 0, indexed: 0, errors: [] };
    this.reportProgress();

    await this.localIndex.clear();

    if (this.supabase) {
      // Clear Supabase index
      await this.supabase.from("omni_search_index").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // Re-index all content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectEngine = getEngine<any>("ProjectEngine");
    if (!projectEngine) {
      this.progress.errors.push("ProjectEngine not available");
      this.progress.phase = "error";
      this.reportProgress();
      return;
    }

    // Get projects
    const projects = await projectEngine.listProjects();
    this.progress.total = projects.length;

    // Index projects
    for (const project of projects) {
      await this.indexEntry({
        id: `project-${project.id}`,
        type: "project",
        itemId: project.id,
        projectId: project.id,
        title: project.name,
        content: project.description || "",
        preview: project.description?.slice(0, 200) || "",
        metadata: {},
        score: 50,
        accessCount: 0,
        timestamp: Date.now(),
      });

      this.progress.indexed++;
      this.progress.currentType = "project";
      this.reportProgress();
    }

    // Index conversations, files, notes, tasks, snippets, clipboard
    // This would be done in batches for performance
    await this.indexWorkspaceContent();

    this.progress.phase = "complete";
    this.reportProgress();
    this.progressCallback = null;
    this.emit("rebuilt");
  }

  /**
   * Index workspace content from Supabase tables
   */
  private async indexWorkspaceContent(): Promise<void> {
    if (!this.supabase) return;

    const types: SearchableType[] = ["conversation", "file", "note", "task", "snippet", "clipboard"];

    for (const type of types) {
      this.progress.currentType = type;
      this.reportProgress();

      try {
        const tableName = this.getTableNameForType(type);
        const { data, error } = await this.supabase
          .from(tableName)
          .select("id, project_id, title, name, content, code, description, created_at")
          .limit(100);

        if (error) continue;
        if (!data) continue;

        const entries: SearchEntry[] = data.map((row: Record<string, unknown>) => ({
          id: `${type}-${row.id as string}`,
          type,
          itemId: row.id as string,
          projectId: row.project_id as string | null,
          title: this.extractTitle(row, type),
          content: this.extractContent(row, type),
          preview: this.extractPreview(row, type),
          metadata: {},
          score: 30,
          accessCount: 0,
          timestamp: new Date(row.created_at as string).getTime(),
        }));

        await this.indexBatch(entries);
        this.progress.total += entries.length;
      } catch (err) {
        this.progress.errors.push(`Failed to index ${type}: ${err}`);
      }
    }
  }

  private getTableNameForType(type: SearchableType): string {
    const tables: Record<SearchableType, string> = {
      project: "omni_projects",
      conversation: "omni_conversations",
      message: "omni_messages",
      file: "omni_files",
      note: "omni_notes",
      task: "omni_tasks",
      snippet: "omni_snippets",
      clipboard: "omni_clipboard_items",
      timeline: "omni_timeline_events",
      pinned: "omni_pinned_items",
    };
    return tables[type] || "omni_projects";
  }

  private extractTitle(row: Record<string, unknown>, type: SearchableType): string {
    if (type === "file") return row.name as string || "Untitled";
    if (type === "conversation") return row.title as string || "Untitled Conversation";
    if (type === "clipboard") return (row.content as string || "").slice(0, 50);
    return row.title as string || "Untitled";
  }

  private extractContent(row: Record<string, unknown>, type: SearchableType): string {
    if (type === "snippet") return row.code as string || "";
    if (type === "clipboard") return row.content as string || "";
    if (type === "task") return row.description as string || "";
    return row.content as string || "";
  }

  private extractPreview(row: Record<string, unknown>, type: SearchableType): string {
    const content = this.extractContent(row, type);
    return content.slice(0, 200);
  }

  private reportProgress(): void {
    if (this.progressCallback) {
      this.progressCallback({ ...this.progress });
    }
  }

  // ============== SEARCH ==============

  /**
   * Execute a search query
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    const start = performance.now();
    const q = query.q.toLowerCase().trim();
    const fuzzy = query.fuzzy ?? true;

    if (!q) {
      return {
        entries: [],
        total: 0,
        query: query.q,
        duration: Math.round(performance.now() - start),
        suggestions: [],
      };
    }

    // Try Supabase full-text search first if available
    if (this.supabase && !query.fuzzy) {
      const supabaseResult = await this.searchWithSupabase(query);
      if (supabaseResult.entries.length > 0) {
        return supabaseResult;
      }
    }

    // Fallback to local search with fuzzy matching
    const entries = Array.from(this.localIndex.values());

    let filtered = entries.filter((entry) => {
      // Type filter
      const matchesType = !query.types || query.types.includes(entry.type);
      if (!matchesType) return false;

      // Project filter
      const matchesProject = !query.projectId || entry.projectId === query.projectId;
      if (!matchesProject) return false;

      // Date filter
      const matchesDate = (!query.from || entry.timestamp >= query.from) &&
        (!query.to || entry.timestamp <= query.to);
      if (!matchesDate) return false;

      // Text match with fuzzy support
      const titleLower = entry.title.toLowerCase();
      const contentLower = entry.content.toLowerCase();

      if (fuzzy) {
        return fuzzyMatch(q, titleLower) || fuzzyMatch(q, contentLower);
      }

      return titleLower.includes(q) || contentLower.includes(q);
    });

    // Calculate scores and sort
    filtered = filtered
      .map((entry) => ({ ...entry, score: calculateScore(entry, q, fuzzy) }))
      .sort((a, b) => b.score - a.score);

    // Generate suggestions
    const suggestions = generateSuggestions(filtered, q);

    // Group by type
    const groups = new Map<SearchableType, SearchEntry[]>();
    for (const entry of filtered) {
      const group = groups.get(entry.type) || [];
      group.push(entry);
      groups.set(entry.type, group);
    }

    // Pagination
    const total = filtered.length;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const paginated = filtered.slice(offset, offset + limit);

    const duration = Math.round(performance.now() - start);

    return {
      entries: paginated,
      total,
      query: query.q,
      duration,
      suggestions,
      groups,
    };
  }

  /**
   * Search using Supabase full-text search
   */
  private async searchWithSupabase(query: SearchQuery): Promise<SearchResult> {
    if (!this.supabase) {
      return { entries: [], total: 0, query: query.q, duration: 0, suggestions: [] };
    }

    const start = performance.now();

    let dbQuery = this.supabase
      .from("omni_search_index")
      .select("id, item_type, item_id, project_id, title, content, preview, metadata, score_boost, access_count, created_at", { count: "exact" })
      .textSearch("search_vector", query.q, { type: "websearch" });

    if (query.types && query.types.length > 0) {
      dbQuery = dbQuery.in("item_type", query.types);
    }

    if (query.projectId) {
      dbQuery = dbQuery.eq("project_id", query.projectId);
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    dbQuery = dbQuery.range(offset, offset + limit - 1);

    const { data, count, error } = await dbQuery;

    if (error) {
      this.log("warn", "Supabase search error", error);
      return { entries: [], total: 0, query: query.q, duration: Math.round(performance.now() - start), suggestions: [] };
    }

    const entries: SearchEntry[] = (data || []).map((row) => ({
      id: row.id,
      type: row.item_type as SearchableType,
      itemId: row.item_id,
      projectId: row.project_id,
      title: row.title,
      content: row.content || "",
      preview: row.preview || "",
      metadata: row.metadata || {},
      score: row.score_boost + row.access_count * 0.1,
      accessCount: row.access_count,
      timestamp: new Date(row.created_at).getTime(),
    }));

    return {
      entries,
      total: count || 0,
      query: query.q,
      duration: Math.round(performance.now() - start),
      suggestions: [],
    };
  }

  /**
   * Get quick suggestions for autocomplete
   */
  async getSuggestions(partial: string, limit = 5): Promise<string[]> {
    const entries = Array.from(this.localIndex.values());
    return generateSuggestions(entries, partial).slice(0, limit);
  }

  /**
   * Track access to an item for relevance scoring
   */
  async trackAccess(id: string): Promise<void> {
    const entry = this.localIndex.get(id);
    if (entry) {
      entry.accessCount++;
      this.localIndex.set(id, entry);

      if (this.supabase) {
        await this.supabase.rpc("increment_search_access_count", { entry_id: id });
      }
    }
  }

  // ============== SAVED SEARCHES ==============

  /**
   * Save a search for later use
   */
  async saveSearch(search: Omit<SavedSearch, "id" | "createdAt" | "updatedAt" | "useCount" | "lastUsedAt">): Promise<SavedSearch> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const saved: SavedSearch = {
      ...search,
      id,
      createdAt: now,
      updatedAt: now,
      useCount: 0,
      lastUsedAt: null,
    };

    if (this.supabase) {
      await this.supabase.from("omni_saved_searches").insert({
        id: saved.id,
        name: saved.name,
        query: saved.query,
        filters: saved.filters,
        sort_by: saved.sortBy,
        sort_order: saved.sortOrder,
        options: {},
        use_count: 0,
        last_used_at: null,
        is_pinned: saved.isPinned,
      });
    }

    this.emit("search-saved", saved);
    return saved;
  }

  /**
   * List all saved searches
   */
  async listSavedSearches(): Promise<SavedSearch[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from("omni_saved_searches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      query: row.query,
      filters: row.filters as SearchFilter,
      sortBy: row.sort_by as "relevance" | "date" | "name",
      sortOrder: row.sort_order as "asc" | "desc",
      useCount: row.use_count,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).getTime() : null,
      isPinned: row.is_pinned,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(id: string): Promise<void> {
    if (this.supabase) {
      await this.supabase.from("omni_saved_searches").delete().eq("id", id);
    }
    this.emit("search-deleted", id);
  }

  // ============== UTILITY ==============

  async getStats(): Promise<{ total: number; types: Record<string, number> }> {
    const types: Record<string, number> = {};
    for (const entry of this.localIndex.values()) {
      types[entry.type] = (types[entry.type] || 0) + 1;
    }
    return { total: this.localIndex.size, types };
  }

  private debouncedSave(): void {
    this.cancelPendingIndex();
    this.indexTimer = setTimeout(() => {
      this.savePendingIndex();
    }, 1000);
  }

  private cancelPendingIndex(): void {
    if (this.indexTimer) {
      clearTimeout(this.indexTimer);
      this.indexTimer = null;
    }
  }

  private async savePendingIndex(): Promise<void> {
    if (this.pendingIndex.length === 0) return;

    const batch = this.pendingIndex.splice(0, this.pendingIndex.length);

    if (this.supabase) {
      const rows = batch.map((entry) => ({
        id: entry.id,
        item_type: entry.type,
        item_id: entry.itemId,
        project_id: entry.projectId,
        title: entry.title,
        content: entry.content,
        preview: entry.preview,
        metadata: entry.metadata,
        score_boost: Math.floor(entry.score),
        access_count: entry.accessCount,
        indexed_at: new Date().toISOString(),
      }));

      // Upsert in batches
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const { error } = await this.supabase
          .from("omni_search_index")
          .upsert(chunk, { onConflict: "id" });

        if (error) {
          this.log("error", "Failed to save search index batch", error);
        }
      }
    }
  }
}

// ============== SINGLETON ==============

let _instance: SearchEngine | null = null;

export function getSearchEngine(): SearchEngine {
  if (!_instance) {
    _instance = new SearchEngine();
  }
  return _instance;
}
