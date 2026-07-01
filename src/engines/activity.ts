/**
 * Pinned Items Engine — Unified pinned items management across all workspace modules.
 *
 * Responsibilities:
 * - Pin/unpin items from any workspace module
 * - Centralized pinned items list
 * - Position ordering
 * - Cross-module queries
 */

import { BaseEngine, type HealthStatus } from "./base";
import type { UUID } from "../types/omni";
import type { PinnedItem, PinnedItemType } from "../models/workspace";

// ============== CONSTANTS ==============

const PINNED_STORE_NAME = "omni_pinned";

// ============== INTERFACES ==============

export interface PinnedItemData {
  id: UUID;
  type: PinnedItemType;
  title: string;
  projectId: UUID;
  createdAt: number;
  position: number;
}

// ============== PINNED ITEMS ENGINE ==============

export class PinnedItemsEngine extends BaseEngine {
  private db: IDBDatabase | null = null;

  constructor() {
    super({ name: "PinnedItemsEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    await this.initDatabase();
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.db = null;
  }

  async health(): Promise<HealthStatus> {
    return {
      ok: this.db !== null,
      message: this.db ? "Pinned Items Engine ready" : "Database not initialized",
      timestamp: Date.now(),
    };
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("OmniPinned", 1);

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

        if (!db.objectStoreNames.contains(PINNED_STORE_NAME)) {
          const store = db.createObjectStore(PINNED_STORE_NAME, { keyPath: "id" });
          store.createIndex("projectId", "projectId", { unique: false });
          store.createIndex("itemType", "itemType", { unique: false });
          store.createIndex("itemId", "itemId", { unique: false });
          store.createIndex("position", "position", { unique: false });
        }
      };
    });
  }

  // ============== PIN OPERATIONS ==============

  async pinItem(
    projectId: UUID,
    itemType: PinnedItemType,
    itemId: UUID
  ): Promise<PinnedItem> {
    // Check if already pinned
    const existing = await this.getPinnedItemByRef(projectId, itemType, itemId);
    if (existing) return existing;

    // Get max position
    const items = await this.listPinnedItems(projectId);
    const maxPosition = items.reduce((max, i) => Math.max(max, i.position), -1);

    const pinnedItem: PinnedItem = {
      id: crypto.randomUUID(),
      projectId,
      itemType,
      itemId,
      position: maxPosition + 1,
      createdAt: Date.now(),
    };

    await this.saveItem(pinnedItem);
    this.emit("pinned:added", { pinnedItem });

    return pinnedItem;
  }

  async unpinItem(projectId: UUID, itemType: PinnedItemType, itemId: UUID): Promise<boolean> {
    const pinnedItem = await this.getPinnedItemByRef(projectId, itemType, itemId);
    if (!pinnedItem) return false;

    await this.deleteItemRecord(pinnedItem.id);
    this.emit("pinned:removed", { pinnedItem });

    return true;
  }

  async togglePin(
    projectId: UUID,
    itemType: PinnedItemType,
    itemId: UUID
  ): Promise<boolean> {
    const existing = await this.getPinnedItemByRef(projectId, itemType, itemId);

    if (existing) {
      await this.unpinItem(projectId, itemType, itemId);
      return false; // Now unpinned
    } else {
      await this.pinItem(projectId, itemType, itemId);
      return true; // Now pinned
    }
  }

  async isPinned(projectId: UUID, itemType: PinnedItemType, itemId: UUID): Promise<boolean> {
    const pinnedItem = await this.getPinnedItemByRef(projectId, itemType, itemId);
    return pinnedItem !== null;
  }

  // ============== QUERIES ==============

  async getPinnedItemByRef(
    projectId: UUID,
    itemType: PinnedItemType,
    itemId: UUID
  ): Promise<PinnedItem | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(PINNED_STORE_NAME, "readonly");
      const store = transaction.objectStore(PINNED_STORE_NAME);
      const index = store.index("itemId");
      const request = index.get(itemId);

      request.onsuccess = () => {
        const item = request.result as PinnedItem | undefined;
        if (item && item.projectId === projectId && item.itemType === itemType) {
          resolve(item);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async listPinnedItems(projectId: UUID): Promise<PinnedItem[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(PINNED_STORE_NAME, "readonly");
      const store = transaction.objectStore(PINNED_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const items = (request.result as PinnedItem[])
          .sort((a, b) => a.position - b.position);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async listPinnedItemsByType(projectId: UUID, itemType: PinnedItemType): Promise<PinnedItem[]> {
    const items = await this.listPinnedItems(projectId);
    return items.filter(i => i.itemType === itemType);
  }

  // ============== ORDERING ==============

  async reorderPinnedItems(projectId: UUID, itemIds: UUID[]): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      const items = await this.listPinnedItems(projectId);
      const item = items.find(it => it.itemId === itemIds[i]);
      if (item) {
        await this.updateItemPosition(item.id, i);
      }
    }
    this.emit("pinned:reordered", { projectId, itemIds });
  }

  async movePinnedItem(pinnedItemId: UUID, newPosition: number): Promise<PinnedItem | null> {
    const item = await this.getItem(pinnedItemId);
    if (!item) return null;

    return this.updateItemPosition(pinnedItemId, newPosition);
  }

  // ============== BULK OPERATIONS ==============

  async clearPinnedItems(projectId: UUID): Promise<number> {
    const items = await this.listPinnedItems(projectId);
    let deleted = 0;

    for (const item of items) {
      await this.deleteItemRecord(item.id);
      deleted++;
    }

    this.emit("pinned:cleared", { projectId, count: deleted });
    return deleted;
  }

  async clearPinnedItemsByType(projectId: UUID, itemType: PinnedItemType): Promise<number> {
    const items = await this.listPinnedItemsByType(projectId, itemType);
    let deleted = 0;

    for (const item of items) {
      await this.deleteItemRecord(item.id);
      deleted++;
    }

    this.emit("pinned:cleared", { projectId, itemType, count: deleted });
    return deleted;
  }

  // ============== PRIVATE HELPERS ==============

  private async getItem(itemId: UUID): Promise<PinnedItem | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(PINNED_STORE_NAME, "readonly");
      const store = transaction.objectStore(PINNED_STORE_NAME);
      const request = store.get(itemId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveItem(item: PinnedItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(PINNED_STORE_NAME, "readwrite");
      const store = transaction.objectStore(PINNED_STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async updateItemPosition(itemId: UUID, position: number): Promise<PinnedItem | null> {
    const item = await this.getItem(itemId);
    if (!item) return null;

    const updatedItem: PinnedItem = {
      ...item,
      position,
    };

    await this.saveItem(updatedItem);
    return updatedItem;
  }

  private async deleteItemRecord(itemId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(PINNED_STORE_NAME, "readwrite");
      const store = transaction.objectStore(PINNED_STORE_NAME);
      const request = store.delete(itemId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Activity Engine — Tracks and displays recent activity across all workspace modules.
 *
 * Responsibilities:
 * - Record activity events
 * - Query recent activity
 * - Activity statistics
 * - Activity cleanup
 */

// ============== ACTIVITY ENGINE ==============

const ACTIVITY_STORE_NAME = "omni_activity";

export class ActivityEngine extends BaseEngine {
  private db: IDBDatabase | null = null;

  constructor() {
    super({ name: "ActivityEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    await this.initDatabase();
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.db = null;
  }

  async health(): Promise<HealthStatus> {
    return {
      ok: this.db !== null,
      message: this.db ? "Activity Engine ready" : "Database not initialized",
      timestamp: Date.now(),
    };
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("OmniActivity", 1);

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

        if (!db.objectStoreNames.contains(ACTIVITY_STORE_NAME)) {
          const store = db.createObjectStore(ACTIVITY_STORE_NAME, { keyPath: "id" });
          store.createIndex("projectId", "projectId", { unique: false });
          store.createIndex("itemType", "itemType", { unique: false });
          store.createIndex("action", "action", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
    });
  }

  // ============== RECORD ACTIVITY ==============

  async recordActivity(
    projectId: UUID,
    action: string,
    itemType: string,
    itemId: UUID | null,
    title?: string,
    description?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const activity: any = {
      id: crypto.randomUUID(),
      projectId,
      action,
      itemType,
      itemId,
      title: title || null,
      description: description || null,
      metadata: metadata || {},
      actorType: "user",
      actorId: null,
      createdAt: Date.now(),
    };

    await this.saveActivity(activity);
    this.emit("activity:recorded", { activity });

    // Auto-cleanup old activities
    await this.autoCleanup(projectId);
  }

  // Convenience methods for common actions
  async recordCreated(projectId: UUID, itemType: string, itemId: UUID, title: string): Promise<void> {
    return this.recordActivity(projectId, "created", itemType, itemId, title);
  }

  async recordUpdated(projectId: UUID, itemType: string, itemId: UUID, title: string): Promise<void> {
    return this.recordActivity(projectId, "updated", itemType, itemId, title);
  }

  async recordDeleted(projectId: UUID, itemType: string, itemId: UUID, title: string): Promise<void> {
    return this.recordActivity(projectId, "deleted", itemType, itemId, title);
  }

  async recordViewed(projectId: UUID, itemType: string, itemId: UUID, title: string): Promise<void> {
    return this.recordActivity(projectId, "viewed", itemType, itemId, title);
  }

  async recordCompleted(projectId: UUID, itemType: string, itemId: UUID, title: string): Promise<void> {
    return this.recordActivity(projectId, "completed", itemType, itemId, title);
  }

  async recordFavorited(projectId: UUID, itemType: string, itemId: UUID, title: string): Promise<void> {
    return this.recordActivity(projectId, "favorited", itemType, itemId, title);
  }

  async recordPinned(projectId: UUID, itemType: string, itemId: UUID, title: string): Promise<void> {
    return this.recordActivity(projectId, "pinned", itemType, itemId, title);
  }

  // ============== QUERIES ==============

  async getRecentActivity(projectId: UUID, limit = 20): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(ACTIVITY_STORE_NAME, "readonly");
      const store = transaction.objectStore(ACTIVITY_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const activities = (request.result as any[])
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, limit);
        resolve(activities);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getActivityByItem(projectId: UUID, itemType: string, itemId: UUID): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(ACTIVITY_STORE_NAME, "readonly");
      const store = transaction.objectStore(ACTIVITY_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const activities = (request.result as any[])
          .filter(a => a.itemType === itemType && a.itemId === itemId)
          .sort((a, b) => b.createdAt - a.createdAt);
        resolve(activities);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getActivityByAction(projectId: UUID, action: string, limit = 20): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(ACTIVITY_STORE_NAME, "readonly");
      const store = transaction.objectStore(ACTIVITY_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const activities = (request.result as any[])
          .filter(a => a.action === action)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, limit);
        resolve(activities);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ============== STATISTICS ==============

  async getActivityStats(projectId: UUID): Promise<{
    total: number;
    byAction: Record<string, number>;
    byItemType: Record<string, number>;
    today: number;
    thisWeek: number;
    thisMonth: number;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(ACTIVITY_STORE_NAME, "readonly");
      const store = transaction.objectStore(ACTIVITY_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const activities = request.result as any[];
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        const byAction: Record<string, number> = {};
        const byItemType: Record<string, number> = {};

        for (const activity of activities) {
          byAction[activity.action] = (byAction[activity.action] || 0) + 1;
          byItemType[activity.itemType] = (byItemType[activity.itemType] || 0) + 1;
        }

        resolve({
          total: activities.length,
          byAction,
          byItemType,
          today: activities.filter(a => now - a.createdAt < dayMs).length,
          thisWeek: activities.filter(a => now - a.createdAt < 7 * dayMs).length,
          thisMonth: activities.filter(a => now - a.createdAt < 30 * dayMs).length,
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ============== CLEANUP ==============

  async autoCleanup(projectId: UUID, maxAge = 30, maxCount = 500): Promise<number> {
    const activities = await this.getRecentActivity(projectId, maxCount + 100);
    const now = Date.now();
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const activity of activities) {
      // Delete old activities
      if (now - activity.createdAt > maxAgeMs) {
        await this.deleteActivity(activity.id);
        deleted++;
      }
    }

    // If still over limit, delete oldest
    const remaining = await this.getRecentActivity(projectId, maxCount + 100);
    if (remaining.length > maxCount) {
      const toDelete = remaining.slice(maxCount);
      for (const activity of toDelete) {
        await this.deleteActivity(activity.id);
        deleted++;
      }
    }

    return deleted;
  }

  async clearActivity(projectId: UUID): Promise<void> {
    const activities = await this.getRecentActivity(projectId, 10000);
    for (const activity of activities) {
      await this.deleteActivity(activity.id);
    }
    this.emit("activity:cleared", { projectId });
  }

  // ============== PRIVATE HELPERS ==============

  private async saveActivity(activity: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(ACTIVITY_STORE_NAME, "readwrite");
      const store = transaction.objectStore(ACTIVITY_STORE_NAME);
      const request = store.put(activity);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteActivity(activityId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(ACTIVITY_STORE_NAME, "readwrite");
      const store = transaction.objectStore(ACTIVITY_STORE_NAME);
      const request = store.delete(activityId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
