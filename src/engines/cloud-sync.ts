/**
 * Cloud Sync Engine — Intelligent synchronization with conflict resolution.
 *
 * Syncs: Projects, Conversations, Notes, Tasks, Files, Snippets, Clipboard, Timeline, Settings
 * Features: Incremental sync, offline queue, conflict detection, resolution
 */

import { BaseEngine } from "./base";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getAuthEngine } from "./auth";

// ============== TYPES ==============

export type SyncEntityType =
  | "project"
  | "conversation"
  | "message"
  | "note"
  | "task"
  | "file"
  | "snippet"
  | "clipboard"
  | "timeline"
  | "pinned"
  | "settings"
  | "connector";

export type SyncOperation = "create" | "update" | "delete";

export type SyncState = "pending" | "synced" | "conflict" | "offline" | "failed";

export type ConflictResolution = "latest_wins" | "local_wins" | "remote_wins" | "manual_merge";

export interface SyncItem {
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  data: Record<string, unknown>;
  localVersion: number;
  remoteVersion?: number;
  checksum?: string;
  timestamp: number;
  priority: number;
}

export interface SyncProgress {
  phase: "idle" | "syncing" | "uploading" | "downloading" | "resolving" | "complete" | "error";
  total: number;
  completed: number;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
  current?: string;
}

export interface SyncConflict {
  entityType: SyncEntityType;
  entityId: string;
  localVersion: number;
  remoteVersion: number;
  localData: Record<string, unknown>;
  remoteData: Record<string, unknown>;
  localTimestamp: number;
  remoteTimestamp: number;
  resolution?: ConflictResolution;
}

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  data: Record<string, unknown>;
  localVersion: number;
  timestamp: number;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "processing" | "completed" | "failed" | "retrying";
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SyncMetadata {
  entityType: SyncEntityType;
  entityId: string;
  localId?: string;
  version: number;
  checksum: string;
  syncState: SyncState;
  lastSyncedAt?: number;
  lastModifiedAt: number;
  deviceId?: string;
}

export interface SyncOptions {
  direction: "bidirectional" | "upload" | "download";
  entities?: SyncEntityType[];
  resolution: ConflictResolution;
  force?: boolean;
}

// ============== ENGINE ==============

export class CloudSyncEngine extends BaseEngine {
  private supabase: SupabaseClient | null = null;
  private deviceId: string | null = null;
  private userId: string | null = null;
  private syncQueue: SyncQueueItem[] = [];
  private offlineQueue: SyncItem[] = [];
  private processing: boolean = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private progressCallback: ((progress: SyncProgress) => void) | null = null;
  private progress: SyncProgress = { phase: "idle", total: 0, completed: 0, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };
  private isOnline: boolean = navigator.onLine;

  constructor() {
    super({ name: "CloudSyncEngine", version: "1.0.0", debug: false });
    this.setupNetworkListeners();
  }

  async start(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    this.deviceId = this.getOrCreateDeviceId();

    // Get current user
    const authEngine = getAuthEngine();
    const user = authEngine.getCurrentUser();
    if (user) {
      this.userId = user.id;
    }

    // Subscribe to auth changes
    authEngine.onAuthStateChange((event) => {
      if (event.user) {
        this.userId = event.user.id;
        this.onAuthenticated();
      } else {
        this.userId = null;
      }
    });

    // Load offline queue
    await this.loadOfflineQueue();

    // If online and authenticated, start sync
    if (this.isOnline && this.userId) {
      this.scheduleSync();
    }

    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    await this.saveOfflineQueue();
    this.isRunning = false;
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    const queueSize = this.syncQueue.length + this.offlineQueue.length;
    return {
      ok: true,
      message: `Sync: ${this.progress.phase}, ${queueSize} pending`,
      timestamp: Date.now(),
    };
  }

  // ============== PUBLIC API ==============

  /**
   * Force an immediate sync
   */
  async syncNow(options?: Partial<SyncOptions>): Promise<SyncProgress> {
    const syncOptions: SyncOptions = {
      direction: "bidirectional",
      resolution: "latest_wins",
      ...options,
    };

    if (!this.userId || !this.supabase) {
      this.progress.phase = "error";
      this.progress.errors.push("Not authenticated");
      return this.progress;
    }

    if (!this.isOnline) {
      this.progress.phase = "error";
      this.progress.errors.push("Offline - sync will resume when online");
      return this.progress;
    }

    if (this.processing) {
      return this.progress;
    }

    this.processing = true;
    this.progress = { phase: "syncing", total: 0, completed: 0, uploaded: 0, downloaded: 0, conflicts: 0, errors: [] };

    try {
      // Step 1: Upload local changes
      if (syncOptions.direction !== "download") {
        await this.uploadChanges(syncOptions);
      }

      // Step 2: Download remote changes
      if (syncOptions.direction !== "upload") {
        await this.downloadChanges(syncOptions);
      }

      // Step 3: Resolve conflicts
      if (this.progress.conflicts > 0) {
        await this.resolveConflicts(syncOptions.resolution);
      }

      // Step 4: Process offline queue
      if (this.isOnline && this.offlineQueue.length > 0) {
        await this.processOfflineQueue();
      }

      this.progress.phase = "complete";
    } catch (error) {
      this.progress.phase = "error";
      this.progress.errors.push(error instanceof Error ? error.message : "Sync failed");
    } finally {
      this.processing = false;
      this.reportProgress();
    }

    return this.progress;
  }

  /**
   * Enqueue an item for sync
   */
  async enqueue(item: SyncItem): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      data: item.data,
      localVersion: item.localVersion,
      timestamp: item.timestamp,
      priority: item.priority,
      attempts: 0,
      maxAttempts: 3,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (this.isOnline && this.userId) {
      this.syncQueue.push(queueItem);
      this.scheduleSync();
    } else {
      // Store for offline sync
      this.offlineQueue.push(item);
      await this.saveOfflineQueue();
    }

    this.emit("enqueued", queueItem);
  }

  /**
   * Get sync status for an entity
   */
  async getSyncMetadata(entityType: SyncEntityType, entityId: string): Promise<SyncMetadata | null> {
    if (!this.supabase || !this.userId) return null;

    const { data, error } = await this.supabase
      .from("omni_cloud_sync_metadata")
      .select("*")
      .eq("user_id", this.userId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .single();

    if (error || !data) return null;

    return {
      entityType: data.entity_type,
      entityId: data.entity_id,
      localId: data.local_id,
      version: data.version,
      checksum: data.checksum,
      syncState: data.sync_state,
      lastSyncedAt: data.last_synced_at ? new Date(data.last_synced_at).getTime() : undefined,
      lastModifiedAt: new Date(data.last_modified_at).getTime(),
      deviceId: data.last_modified_device_id,
    };
  }

  /**
   * Get all pending sync items
   */
  getPendingSyncItems(): SyncQueueItem[] {
    return this.syncQueue.filter((item) => item.status === "pending");
  }

  /**
   * Get offline queue
   */
  getOfflineQueue(): SyncItem[] {
    return [...this.offlineQueue];
  }

  /**
   * Get current sync progress
   */
  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: SyncProgress) => void): () => void {
    this.progressCallback = callback;
    return () => {
      this.progressCallback = null;
    };
  }

  /**
   * Resolve a specific conflict
   */
  async resolveConflict(conflict: SyncConflict, resolution: ConflictResolution): Promise<void> {
    let winningData: Record<string, unknown>;

    switch (resolution) {
      case "local_wins":
        winningData = conflict.localData;
        break;
      case "remote_wins":
        winningData = conflict.remoteData;
        break;
      case "latest_wins":
        winningData = conflict.localTimestamp > conflict.remoteTimestamp
          ? conflict.localData
          : conflict.remoteData;
        break;
      case "manual_merge":
        // This would require user interaction
        throw new Error("Manual merge requires user interaction");
      default:
        winningData = conflict.remoteData;
    }

    // Update the entity with the winning data
    await this.applyRemoteData(conflict.entityType, conflict.entityId, winningData);

    // Update sync metadata
    await this.updateSyncMetadata(conflict.entityType, conflict.entityId, {
      version: Math.max(conflict.localVersion, conflict.remoteVersion) + 1,
      checksum: this.computeChecksum(winningData),
      syncState: "synced",
      conflictData: null,
    });
  }

  // ============== UPLOAD ==============

  private async uploadChanges(options: SyncOptions): Promise<void> {
    this.progress.phase = "uploading";
    this.progress.total = this.syncQueue.length;
    this.reportProgress();

    const batch = options.entities
      ? this.syncQueue.filter((item) => options.entities!.includes(item.entityType))
      : this.syncQueue;

    for (const item of batch) {
      if (!this.isOnline) {
        this.offlineQueue.push(this.queueItemToSyncItem(item));
        continue;
      }

      try {
        await this.processQueueItem(item);
        this.progress.completed++;
        this.progress.uploaded++;
      } catch (error) {
        item.attempts++;
        item.status = item.attempts >= item.maxAttempts ? "failed" : "retrying";
        item.error = error instanceof Error ? error.message : "Upload failed";
        this.progress.errors.push(item.error);
      }

      this.reportProgress();
    }

    // Remove completed items
    this.syncQueue = this.syncQueue.filter((item) => item.status !== "completed");
    await this.saveOfflineQueue();
  }

  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    if (!this.supabase || !this.userId) return;

    item.status = "processing";
    item.updatedAt = Date.now();

    const tableName = this.getTableName(item.entityType);
    const checksum = this.computeChecksum(item.data);

    // Check for conflicts
    const { data: existing } = await this.supabase
      .from("omni_cloud_sync_metadata")
      .select("version, checksum")
      .eq("user_id", this.userId)
      .eq("entity_type", item.entityType)
      .eq("entity_id", item.entityId)
      .single();

    if (existing && existing.checksum !== checksum) {
      // Conflict detected
      this.progress.conflicts++;
      await this.handleConflict(item, existing.version);
      return;
    }

    // Apply the change
    if (item.operation === "delete") {
      await this.supabase.from(tableName).delete().eq("id", item.entityId);
    } else {
      const record = {
        ...item.data,
        id: item.entityId,
        user_id: this.userId,
        updated_at: new Date().toISOString(),
      };
      await this.supabase.from(tableName).upsert(record);
    }

    // Update sync metadata
    await this.updateSyncMetadata(item.entityType, item.entityId, {
      version: (existing?.version || 0) + 1,
      checksum,
      syncState: "synced",
    });

    item.status = "completed";
    this.emit("synced", item);
  }

  // ============== DOWNLOAD ==============

  private async downloadChanges(options: SyncOptions): Promise<void> {
    if (!this.supabase || !this.userId) return;

    this.progress.phase = "downloading";
    this.reportProgress();

    const entityTypes = options.entities || [
      "project", "conversation", "message", "note", "task", "file", "snippet", "clipboard", "timeline", "pinned", "settings", "connector"
    ];

    for (const entityType of entityTypes) {
      await this.downloadEntityChanges(entityType);
    }
  }

  private async downloadEntityChanges(entityType: SyncEntityType): Promise<void> {
    if (!this.supabase || !this.userId) return;

    const tableName = this.getTableName(entityType);

    // Get last sync timestamp for this entity type
    const { data: lastSync } = await this.supabase
      .from("omni_cloud_sync_metadata")
      .select("last_synced_at")
      .eq("user_id", this.userId)
      .eq("entity_type", entityType)
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .single();

    const since = lastSync?.last_synced_at || new Date(0).toISOString();

    // Get remote changes
    const { data: changes, error } = await this.supabase
      .from(tableName)
      .select("*")
      .eq("user_id", this.userId)
      .gte("updated_at", since);

    if (error || !changes) return;

    for (const change of changes) {
      await this.applyRemoteData(entityType, change.id, change);
      this.progress.downloaded++;
      this.progress.completed++;
      this.reportProgress();
    }
  }

  private async applyRemoteData(entityType: SyncEntityType, entityId: string, data: Record<string, unknown>): Promise<void> {
    // Update in local IndexedDB/storage
    // This would integrate with the existing engines (ProjectEngine, NotesEngine, etc.)
    // For now, we emit the change event
    this.emit("apply-remote", { entityType, entityId, data });
  }

  // ============== CONFLICT HANDLING ==============

  private async handleConflict(item: SyncQueueItem, remoteVersion: number): Promise<void> {
    if (!this.supabase || !this.userId) return;

    const tableName = this.getTableName(item.entityType);

    // Fetch remote data for conflict
    const { data: remoteData } = await this.supabase
      .from(tableName)
      .select("*")
      .eq("id", item.entityId)
      .single();

    const conflict: SyncConflict = {
      entityType: item.entityType,
      entityId: item.entityId,
      localVersion: item.localVersion,
      remoteVersion,
      localData: item.data,
      remoteData: remoteData || {},
      localTimestamp: item.timestamp,
      remoteTimestamp: new Date(remoteData?.updated_at || 0).getTime(),
    };

    // Store conflict for later resolution
    await this.supabase.from("omni_cloud_sync_metadata").upsert({
      user_id: this.userId,
      entity_type: item.entityType,
      entity_id: item.entityId,
      sync_state: "conflict",
      conflict_data: conflict,
    });

    this.emit("conflict", conflict);
  }

  private async resolveConflicts(resolution: ConflictResolution): Promise<void> {
    if (!this.supabase || !this.userId) return;

    this.progress.phase = "resolving";
    this.reportProgress();

    // Get all conflicts
    const { data: conflicts } = await this.supabase
      .from("omni_cloud_sync_metadata")
      .select("*")
      .eq("user_id", this.userId)
      .eq("sync_state", "conflict");

    if (!conflicts) return;

    for (const conflict of conflicts) {
      const conflictData = conflict.conflict_data as SyncConflict;
      if (conflictData) {
        await this.resolveConflict(conflictData, resolution);
      }
    }
  }

  // ============== SYNC METADATA ==============

  private async updateSyncMetadata(
    entityType: SyncEntityType,
    entityId: string,
    updates: Partial<SyncMetadata> & { conflictData?: SyncConflict | null }
  ): Promise<void> {
    if (!this.supabase || !this.userId) return;

    await this.supabase.from("omni_cloud_sync_metadata").upsert({
      user_id: this.userId,
      entity_type: entityType,
      entity_id: entityId,
      version: updates.version || 1,
      checksum: updates.checksum || "",
      sync_state: updates.syncState || "synced",
      last_synced_at: new Date().toISOString(),
      last_modified_at: new Date().toISOString(),
      last_modified_device_id: this.deviceId,
      conflict_data: updates.conflictData || null,
    }, { onConflict: "user_id,entity_type,entity_id" });
  }

  // ============== UTILITIES ==============

  private getTableName(entityType: SyncEntityType): string {
    const tables: Record<SyncEntityType, string> = {
      project: "omni_projects",
      conversation: "omni_conversations",
      message: "omni_messages",
      note: "omni_notes",
      task: "omni_tasks",
      file: "omni_files",
      snippet: "omni_snippets",
      clipboard: "omni_clipboard_items",
      timeline: "omni_timeline_events",
      pinned: "omni_pinned_items",
      settings: "omni_user_profiles",
      connector: "omni_connectors",
    };
    return tables[entityType] || entityType;
  }

  private computeChecksum(data: Record<string, unknown>): string {
    // Simple hash function for checksum
    const str = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private getOrCreateDeviceId(): string {
    const key = "omni_device_id";
    let deviceId = localStorage.getItem(key);
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(key, deviceId);
    }
    return deviceId;
  }

  private queueItemToSyncItem(item: SyncQueueItem): SyncItem {
    return {
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      data: item.data,
      localVersion: 0,
      timestamp: item.createdAt,
      priority: item.priority,
    };
  }

  private reportProgress(): void {
    if (this.progressCallback) {
      this.progressCallback({ ...this.progress });
    }
    this.emit("progress", this.progress);
  }

  private scheduleSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      if (this.isOnline && this.userId && !this.processing) {
        this.syncNow();
      }
    }, 5000);
  }

  private setupNetworkListeners(): void {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.emit("online");
      if (this.userId && this.offlineQueue.length > 0) {
        this.processOfflineQueue();
      }
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.emit("offline");
    });
  }

  private async onAuthenticated(): Promise<void> {
    // Register device
    await this.registerDevice();
    // Start sync
    this.scheduleSync();
  }

  private async registerDevice(): Promise<void> {
    if (!this.supabase || !this.userId) return;

    await this.supabase.from("omni_user_devices").upsert({
      user_id: this.userId,
      id: this.deviceId,
      device_name: this.getDeviceName(),
      device_type: "browser",
      browser_name: this.getBrowserName(),
      os_name: this.getOSName(),
      is_current: true,
      last_active_at: new Date().toISOString(),
    });
  }

  private getDeviceName(): string {
    return `${this.getBrowserName()} on ${this.getOSName()}`;
  }

  private getBrowserName(): string {
    const ua = navigator.userAgent;
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return "Unknown Browser";
  }

  private getOSName(): string {
    const ua = navigator.userAgent;
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iOS")) return "iOS";
    return "Unknown OS";
  }

  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || !this.userId || this.processing) return;

    const items = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of items) {
      await this.enqueue(item);
    }

    await this.saveOfflineQueue();
  }

  private async loadOfflineQueue(): Promise<void> {
    // Load from IndexedDB or localStorage
    const stored = localStorage.getItem("omni_offline_queue");
    if (stored) {
      try {
        this.offlineQueue = JSON.parse(stored);
      } catch {
        this.offlineQueue = [];
      }
    }
  }

  private async saveOfflineQueue(): Promise<void> {
    localStorage.setItem("omni_offline_queue", JSON.stringify(this.offlineQueue));
  }
}

// ============== SINGLETON ==============

let _instance: CloudSyncEngine | null = null;

export function getCloudSyncEngine(): CloudSyncEngine {
  if (!_instance) {
    _instance = new CloudSyncEngine();
  }
  return _instance;
}
