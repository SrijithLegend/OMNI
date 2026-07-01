/**
 * Clipboard History Engine — Monitors and manages clipboard history.
 *
 * Responsibilities:
 * - Capture clipboard content automatically
 * - Content type detection
 * - Privacy controls (ignore sensitive inputs, passwords)
 * - Auto-cleanup based on age and size limits
 * - Favorites and pinning
 * - Quick copy functionality
 */

import { BaseEngine, type HealthStatus } from "./base";
import type { UUID } from "../types/omni";
import type { ClipboardItem, ClipboardContentType, ClipboardFilter } from "../models/workspace";
import { createClipboardItem, detectContentType, detectLanguage } from "../models/workspace";

// ============== CONSTANTS ==============

const CLIPBOARD_STORE_NAME = "omni_clipboard";
const MAX_HISTORY_SIZE = 500;
const MAX_ITEM_SIZE = 100 * 1024; // 100 KB
const CLEANUP_AGE_DAYS = 30; // Delete items older than 30 days
const POLL_INTERVAL = 1000; // Poll clipboard every second

// Sensitive patterns to ignore
const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /api[_-]?key/i,
  /token/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
];

// Password field selectors
const PASSWORD_SELECTORS = [
  'input[type="password"]',
  'input[name*="password"]',
  'input[name*="passwd"]',
  'input[name*="secret"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]',
];

// ============== INTERFACES ==============

export interface ClipboardConfig {
  enabled: boolean;
  autoCapture: boolean;
  ignorePasswordFields: boolean;
  ignoreSensitivePatterns: boolean;
  maxHistorySize: number;
  maxItemSize: number;
  cleanupAgeDays: number;
  captureGlobal: boolean; // Capture from anywhere, not just in extension
}

export interface ClipboardUpdateData {
  isFavorite?: boolean;
  isPinned?: boolean;
  isSensitive?: boolean;
  tags?: string[];
  isDeleted?: boolean;
  copyCount?: number;
  lastCopiedAt?: number | null;
}

// ============== CLIPBOARD ENGINE ==============

export class ClipboardEngine extends BaseEngine {
  private db: IDBDatabase | null = null;
  private config: ClipboardConfig;
  private lastContent: string = "";
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isFocusedOnPassword: boolean = false;

  constructor(config?: Partial<ClipboardConfig>) {
    super({ name: "ClipboardEngine", version: "1.0.0", debug: false });
    this.config = {
      enabled: config?.enabled ?? true,
      autoCapture: config?.autoCapture ?? true,
      ignorePasswordFields: config?.ignorePasswordFields ?? true,
      ignoreSensitivePatterns: config?.ignoreSensitivePatterns ?? true,
      maxHistorySize: config?.maxHistorySize || MAX_HISTORY_SIZE,
      maxItemSize: config?.maxItemSize || MAX_ITEM_SIZE,
      cleanupAgeDays: config?.cleanupAgeDays || CLEANUP_AGE_DAYS,
      captureGlobal: config?.captureGlobal ?? false,
    };
  }

  async start(): Promise<void> {
    this.isRunning = true;
    await this.initDatabase();

    if (this.config.autoCapture) {
      this.startMonitoring();
    }

    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.stopMonitoring();
    this.db = null;
  }

  async health(): Promise<HealthStatus> {
    return {
      ok: this.db !== null,
      message: this.db ? "Clipboard Engine ready" : "Database not initialized",
      timestamp: Date.now(),
    };
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("OmniClipboard", 1);

      request.onerror = () => {
        this.emit("error", { error: request.error });
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(CLIPBOARD_STORE_NAME)) {
          const store = db.createObjectStore(CLIPBOARD_STORE_NAME, { keyPath: "id" });
          store.createIndex("projectId", "projectId", { unique: false });
          store.createIndex("contentType", "contentType", { unique: false });
          store.createIndex("isFavorite", "isFavorite", { unique: false });
          store.createIndex("isPinned", "isPinned", { unique: false });
          store.createIndex("isDeleted", "isDeleted", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("expiresAt", "expiresAt", { unique: false });
        }
      };
    });
  }

  // ============== MONITORING ==============

  private startMonitoring(): void {
    // Track focus on password fields
    if (this.config.ignorePasswordFields) {
      document.addEventListener("focusin", this.handleFocusIn, true);
      document.addEventListener("focusout", this.handleFocusOut, true);
    }

    // Start clipboard polling
    if (this.config.captureGlobal) {
      // Note: Clipboard API requires permissions or focus
      // In Chrome extension context, we can request clipboardRead permission
      this.pollInterval = setInterval(() => {
        this.captureClipboard();
      }, POLL_INTERVAL);
    }
  }

  private stopMonitoring(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.config.ignorePasswordFields) {
      document.removeEventListener("focusin", this.handleFocusIn, true);
      document.removeEventListener("focusout", this.handleFocusOut, true);
    }
  }

  private handleFocusIn = (event: FocusEvent): void => {
    const target = event.target as HTMLElement;
    if (target && target.matches) {
      this.isFocusedOnPassword = PASSWORD_SELECTORS.some(sel => target.matches(sel));
    }
  };

  private handleFocusOut = (): void => {
    // Delay to allow potential clipboard copy
    setTimeout(() => {
      this.isFocusedOnPassword = false;
    }, 100);
  };

  // ============== CLIPBOARD CAPTURE ==============

  async captureClipboard(projectId: UUID | null = null): Promise<ClipboardItem | null> {
    if (!this.config.enabled) return null;

    // Skip if focused on password field
    if (this.isFocusedOnPassword && this.config.ignorePasswordFields) {
      return null;
    }

    try {
      // Try to read from clipboard
      const text = await navigator.clipboard.readText();

      if (!text || text === this.lastContent) {
        return null;
      }

      // Validate size
      if (text.length > this.config.maxItemSize) {
        // Truncate but still capture
        const truncated = text.slice(0, this.config.maxItemSize);
        return this.captureText(truncated, projectId, true);
      }

      // Check for sensitive patterns
      if (this.config.ignoreSensitivePatterns && this.isSensitive(text)) {
        // Still capture but mark as sensitive
        return this.captureText(text, projectId, false, true);
      }

      this.lastContent = text;
      return this.captureText(text, projectId);
    } catch (error) {
      // Clipboard read failed - may not have permission
      this.emit("error", { error, context: "captureClipboard" });
      return null;
    }
  }

  async captureText(
    text: string,
    projectId: UUID | null = null,
    isTruncated = false,
    isSensitive = false
  ): Promise<ClipboardItem> {
    const item = createClipboardItem(text, projectId);
    item.isSensitive = isSensitive;

    if (isTruncated) {
      item.content = text;
      item.charCount = text.length;
    }

    // Set expiration date
    if (this.config.cleanupAgeDays > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.config.cleanupAgeDays);
      item.expiresAt = expiresAt.getTime();
    }

    // Detect source URL if available
    if (typeof window !== "undefined") {
      item.sourceUrl = window.location.href;
    }

    await this.saveItem(item);

    // Check for duplicates and increment count instead
    await this.checkForDuplicate(item);

    this.emit("clipboard:captured", { item });

    // Auto-cleanup if over limit
    await this.autoCleanup(projectId);

    return item;
  }

  async captureFromCopyEvent(event: ClipboardEvent, projectId: UUID | null = null): Promise<ClipboardItem | null> {
    if (!this.config.enabled) return null;

    // Skip if focused on password field
    if (this.isFocusedOnPassword && this.config.ignorePasswordFields) {
      return null;
    }

    const clipboardData = event.clipboardData;
    if (!clipboardData) return null;

    const text = clipboardData.getData("text/plain");
    if (!text) return null;

    // Skip if same as last content
    if (text === this.lastContent) return null;

    this.lastContent = text;

    // Check for sensitive patterns
    const isSensitive = this.config.ignoreSensitivePatterns && this.isSensitive(text);

    return this.captureText(text, projectId, false, isSensitive);
  }

  // ============== ITEM OPERATIONS ==============

  async getItem(itemId: UUID): Promise<ClipboardItem | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(CLIPBOARD_STORE_NAME, "readonly");
      const store = transaction.objectStore(CLIPBOARD_STORE_NAME);
      const request = store.get(itemId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateItem(itemId: UUID, data: ClipboardUpdateData): Promise<ClipboardItem | null> {
    const item = await this.getItem(itemId);
    if (!item) return null;

    const updatedItem = {
      ...item,
      ...data,
    } as ClipboardItem;

    await this.saveItem(updatedItem);
    this.emit("clipboard:updated", { item: updatedItem });

    return updatedItem;
  }

  async deleteItem(itemId: UUID, permanent = false): Promise<boolean> {
    const item = await this.getItem(itemId);
    if (!item) return false;

    if (permanent) {
      await this.deleteItemRecord(itemId);
      this.emit("clipboard:deleted", { itemId, permanent: true });
    } else {
      await this.updateItem(itemId, { isDeleted: true });
      this.emit("clipboard:deleted", { itemId, permanent: false });
    }

    return true;
  }

  async restoreItem(itemId: UUID): Promise<ClipboardItem | null> {
    return this.updateItem(itemId, { isDeleted: false });
  }

  async toggleFavorite(itemId: UUID): Promise<ClipboardItem | null> {
    const item = await this.getItem(itemId);
    if (!item) return null;

    return this.updateItem(itemId, { isFavorite: !item.isFavorite });
  }

  async togglePinned(itemId: UUID): Promise<ClipboardItem | null> {
    const item = await this.getItem(itemId);
    if (!item) return null;

    return this.updateItem(itemId, { isPinned: !item.isPinned });
  }

  // ============== COPY OPERATIONS ==============

  async copyItem(itemId: UUID): Promise<string | null> {
    const item = await this.getItem(itemId);
    if (!item) return null;

    try {
      await navigator.clipboard.writeText(item.content);

      // Update copy count and timestamp
      await this.saveItem({
        ...item,
        copyCount: item.copyCount + 1,
        lastCopiedAt: Date.now(),
      });

      this.lastContent = item.content;
      this.emit("clipboard:copied", { item });

      return item.content;
    } catch (error) {
      this.emit("error", { error, context: "copyItem" });
      return null;
    }
  }

  // ============== QUERIES ==============

  async listItems(projectId: UUID | null, filter?: ClipboardFilter): Promise<ClipboardItem[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(CLIPBOARD_STORE_NAME, "readonly");
      const store = transaction.objectStore(CLIPBOARD_STORE_NAME);

      const request = projectId
        ? store.index("projectId").getAll(projectId)
        : store.getAll();

      request.onsuccess = () => {
        let items = request.result as ClipboardItem[];

        // Apply filters
        if (filter) {
          // Exclude deleted by default
          if (filter.isDeleted === undefined) {
            items = items.filter(i => !i.isDeleted);
          }

          if (filter.contentType?.length) {
            items = items.filter(i => filter.contentType!.includes(i.contentType));
          }

          if (filter.isFavorite !== undefined) {
            items = items.filter(i => i.isFavorite === filter.isFavorite);
          }

          if (filter.isPinned !== undefined) {
            items = items.filter(i => i.isPinned === filter.isPinned);
          }

          if (filter.search) {
            const search = filter.search.toLowerCase();
            items = items.filter(i => i.content.toLowerCase().includes(search));
          }
        } else {
          // Exclude deleted by default
          items = items.filter(i => !i.isDeleted);
        }

        // Sort by creation date, pinned first
        items.sort((a, b) => {
          // Pinned items first
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          // Then by creation date
          return b.createdAt - a.createdAt;
        });

        resolve(items);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getRecentItems(projectId: UUID | null = null, limit = 20): Promise<ClipboardItem[]> {
    const items = await this.listItems(projectId);
    return items.slice(0, limit);
  }

  async getFavoriteItems(projectId: UUID | null = null): Promise<ClipboardItem[]> {
    return this.listItems(projectId, { isFavorite: true });
  }

  async getPinnedItems(projectId: UUID | null = null): Promise<ClipboardItem[]> {
    const items = await this.listItems(projectId);
    return items.filter(i => i.isPinned);
  }

  async getItemsByType(projectId: UUID | null, contentType: ClipboardContentType): Promise<ClipboardItem[]> {
    return this.listItems(projectId, { contentType: [contentType] });
  }

  async searchItems(projectId: UUID | null, query: string): Promise<ClipboardItem[]> {
    return this.listItems(projectId, { search: query });
  }

  // ============== CLEANUP ==============

  async autoCleanup(projectId: UUID | null = null): Promise<number> {
    let deleted = 0;

    // Delete expired items
    const items = await this.listItems(projectId);
    const now = Date.now();

    for (const item of items) {
      // Skip pinned items
      if (item.isPinned) continue;

      // Delete expired
      if (item.expiresAt && item.expiresAt < now) {
        await this.deleteItem(item.id, true);
        deleted++;
        continue;
      }

      // Delete old and not favorite
      const ageDays = (now - item.createdAt) / (1000 * 60 * 60 * 24);
      if (ageDays > this.config.cleanupAgeDays && !item.isFavorite) {
        await this.deleteItem(item.id, true);
        deleted++;
      }
    }

    // Check total count
    const remaining = await this.listItems(projectId);
    if (remaining.length > this.config.maxHistorySize) {
      // Remove oldest non-pinned, non-favorite items
      const toRemove = remaining
        .filter(i => !i.isPinned && !i.isFavorite)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(this.config.maxHistorySize);

      for (const item of toRemove) {
        await this.deleteItem(item.id, true);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.emit("clipboard:cleaned", { deletedCount: deleted });
    }

    return deleted;
  }

  async clearHistory(projectId: UUID | null = null, keepPinned = true, keepFavorites = true): Promise<number> {
    const items = await this.listItems(projectId);
    let deleted = 0;

    for (const item of items) {
      // Skip pinned if requested
      if (keepPinned && item.isPinned) continue;
      // Skip favorites if requested
      if (keepFavorites && item.isFavorite) continue;

      await this.deleteItem(item.id, true);
      deleted++;
    }

    this.emit("clipboard:cleared", { deletedCount: deleted });
    return deleted;
  }

  // ============== STATISTICS ==============

  async getStats(projectId: UUID | null = null): Promise<{
    total: number;
    byType: Record<ClipboardContentType, number>;
    favoritesCount: number;
    pinnedCount: number;
    sensitiveCount: number;
    totalSize: number;
    oldestItem: number | null;
    newestItem: number | null;
  }> {
    const items = await this.listItems(projectId);

    const byType: Record<ClipboardContentType, number> = {
      text: 0,
      code: 0,
      link: 0,
      path: 0,
      command: 0,
      prompt: 0,
    };

    for (const item of items) {
      byType[item.contentType] = (byType[item.contentType] || 0) + 1;
    }

    const timestamps = items.map(i => i.createdAt);

    return {
      total: items.length,
      byType,
      favoritesCount: items.filter(i => i.isFavorite).length,
      pinnedCount: items.filter(i => i.isPinned).length,
      sensitiveCount: items.filter(i => i.isSensitive).length,
      totalSize: items.reduce((sum, i) => sum + i.charCount, 0),
      oldestItem: timestamps.length ? Math.min(...timestamps) : null,
      newestItem: timestamps.length ? Math.max(...timestamps) : null,
    };
  }

  // ============== CONFIGURATION ==============

  updateConfig(newConfig: Partial<ClipboardConfig>): void {
    const wasMonitoring = this.pollInterval !== null;

    this.config = {
      ...this.config,
      ...newConfig,
    };

    // Restart monitoring if needed
    if (wasMonitoring && !this.config.autoCapture) {
      this.stopMonitoring();
    } else if (!wasMonitoring && this.config.autoCapture) {
      this.startMonitoring();
    }
  }

  enable(): void {
    this.updateConfig({ enabled: true });
  }

  disable(): void {
    this.updateConfig({ enabled: false });
  }

  // ============== PRIVATE HELPERS ==============

  private isSensitive(content: string): boolean {
    // Check against sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        return true;
      }
    }

    // Check if it looks like a credential
    // Common patterns for API keys, tokens, etc.
    if (/^[a-zA-Z0-9_-]{20,}$/.test(content.trim())) {
      return true;
    }

    // Check for common credential formats
    if (/^sk-[a-zA-Z0-9]{20,}/.test(content)) return true; // OpenAI keys
    if (/^xox[baprs]-/.test(content)) return true; // Slack tokens
    if (/^ghp_[a-zA-Z0-9]{36}/.test(content)) return true; // GitHub PAT
    if (/^AKIA[0-9A-Z]{16}/.test(content)) return true; // AWS Access Key

    return false;
  }

  private async checkForDuplicate(newItem: ClipboardItem): Promise<void> {
    const items = await this.listItems(newItem.projectId);

    // Find duplicate by content
    const duplicate = items.find(i =>
      i.content === newItem.content &&
      i.id !== newItem.id &&
      !i.isDeleted
    );

    if (duplicate) {
      // Update the existing item's copy count instead
      await this.saveItem({
        ...duplicate,
        copyCount: duplicate.copyCount + 1,
        lastCopiedAt: Date.now(),
      });

      // Delete the new duplicate
      await this.deleteItemRecord(newItem.id);
    }
  }

  private async saveItem(item: ClipboardItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(CLIPBOARD_STORE_NAME, "readwrite");
      const store = transaction.objectStore(CLIPBOARD_STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteItemRecord(itemId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(CLIPBOARD_STORE_NAME, "readwrite");
      const store = transaction.objectStore(CLIPBOARD_STORE_NAME);
      const request = store.delete(itemId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
