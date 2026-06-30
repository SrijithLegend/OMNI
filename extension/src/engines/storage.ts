/**
 * Storage Engine — Unified storage with tiered backends.
 *
 * Handles: Chrome Storage (small/fast), IndexedDB (large), Memory (cache).
 * All storage operations go through here. No direct storage calls anywhere else.
 */

import { BaseEngine, registerEngine, getEngine } from "./base";
import type { StorageAdapter } from "../storage/adapter";
import { ChromeStorageAdapter } from "../storage/chrome-adapter";
import { IndexedDBStorageAdapter } from "../storage/indexeddb-adapter";
import { MemoryStorageAdapter } from "../storage/memory-adapter";

const STORAGE_KEYS = {
  WORKSPACE: "omni_workspace",
  PROJECTS: "omni_projects",
  CONVERSATIONS: "omni_conversations",
  SETTINGS: "omni_settings",
  USER: "omni_user",
  TIMELINE: "omni_timeline",
  CONNECTORS: "omni_connectors",
  HISTORY: "omni_history",
  CACHE: "omni_cache",
  BACKUP: "omni_backup",
  MIGRATION: "omni_migration_version",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

interface StorageConfig {
  primary: "chrome" | "indexeddb" | "memory";
  cache: boolean;
  backupInterval: number;
}

export class StorageEngine extends BaseEngine {
  private primary: StorageAdapter;
  private cache: MemoryStorageAdapter;
  private config: StorageConfig;

  constructor(config: Partial<StorageConfig> = {}) {
    super({ name: "StorageEngine", version: "1.0.0", debug: false });
    this.config = {
      primary: config.primary ?? "chrome",
      cache: config.cache ?? true,
      backupInterval: config.backupInterval ?? 24,
    };
    this.primary = this.createAdapter(this.config.primary);
    this.cache = new MemoryStorageAdapter(50);
    this.dependsOn("LoggingEngine");
  }

  async start(): Promise<void> {
    await this.primary.connect();
    if (this.config.cache) await this.cache.connect();
    this.isRunning = true;
    this.log("info", "Storage engine started", this.config.primary);
  }

  async stop(): Promise<void> {
    await this.primary.disconnect();
    await this.cache.disconnect();
    this.isRunning = false;
    this.log("info", "Storage engine stopped");
  }

  async health(): Promise<import("./base").HealthStatus> {
    const h = await this.primary.health();
    return {
      ok: h.ok,
      message: h.message,
      details: { used: h.used, quota: h.quota },
      timestamp: Date.now(),
    };
  }

  /** Read from cache first, then storage. */
  async get<T>(key: StorageKey): Promise<T | null> {
    if (this.config.cache) {
      const cached = await this.cache.get<T>(key);
      if (cached !== null) return cached;
    }
    const value = await this.primary.get<T>(key);
    if (value !== null && this.config.cache) {
      await this.cache.set(key, value, 60_000); // 1 min cache
    }
    return value;
  }

  /** Write to storage and cache simultaneously. */
  async set<T>(key: StorageKey, value: T): Promise<void> {
    await this.primary.set(key, value);
    if (this.config.cache) {
      await this.cache.set(key, value, 60_000);
    }
    this.emit("change", { key, action: "set" });
  }

  /** Remove from both storage and cache. */
  async remove(key: StorageKey): Promise<void> {
    await this.primary.remove(key);
    if (this.config.cache) await this.cache.remove(key);
    this.emit("change", { key, action: "remove" });
  }

  /** Multi-get with single cache lookup. */
  async getMany<T extends Record<string, unknown>>(keys: StorageKey[]): Promise<Partial<T>> {
    const result: Partial<T> = {};
    const missing: string[] = [];

    for (const key of keys) {
      if (this.config.cache) {
        const cached = await this.cache.get<unknown>(key);
        if (cached !== null) {
          (result as Record<string, unknown>)[key] = cached;
          continue;
        }
      }
      missing.push(key);
    }

    if (missing.length > 0) {
      const fromStore = await this.primary.getMany<T>(missing);
      for (const [k, v] of Object.entries(fromStore)) {
        (result as Record<string, unknown>)[k] = v;
        if (this.config.cache && v !== undefined) {
          await this.cache.set(k, v, 60_000);
        }
      }
    }

    return result;
  }

  /** Multi-set with cache update. */
  async setMany<T extends Record<string, unknown>>(values: Record<StorageKey, T[keyof T]>): Promise<void> {
    await this.primary.setMany(values);
    if (this.config.cache) {
      for (const [k, v] of Object.entries(values)) {
        await this.cache.set(k, v, 60_000);
      }
    }
    this.emit("change", { keys: Object.keys(values), action: "setMany" });
  }

  /** Clear all data. */
  async clear(): Promise<void> {
    await this.primary.clear();
    await this.cache.clear();
    this.emit("change", { action: "clear" });
  }

  /** List all stored keys. */
  async keys(): Promise<string[]> {
    return this.primary.keys();
  }

  /** Check if a key exists. */
  async has(key: StorageKey): Promise<boolean> {
    if (this.config.cache && (await this.cache.has(key))) return true;
    return this.primary.has(key);
  }

  /** Get storage health info. */
  async getStorageInfo(): Promise<{ primary: string; health: string; cache: string }> {
    const p = await this.primary.health();
    const c = await this.cache.health();
    return {
      primary: this.primary.name,
      health: p.message,
      cache: c.message,
    };
  }

  /** Export all data for backup. */
  async exportAll(): Promise<Record<string, unknown>> {
    const keys = await this.keys();
    const data: Record<string, unknown> = {};
    for (const key of keys) {
      data[key] = await this.get(key);
    }
    return data;
  }

  /** Import data from backup. */
  async importAll(data: Record<string, unknown>): Promise<void> {
    await this.primary.setMany(data);
    if (this.config.cache) {
      for (const [k, v] of Object.entries(data)) {
        await this.cache.set(k, v, 60_000);
      }
    }
    this.emit("change", { action: "import" });
  }

  /** Switch to a different storage backend. */
  async migrate(to: "chrome" | "indexeddb" | "memory"): Promise<void> {
    const data = await this.exportAll();
    await this.primary.disconnect();
    this.primary = this.createAdapter(to);
    await this.primary.connect();
    await this.primary.setMany(data);
    this.config.primary = to;
    this.emit("migrate", { to, keys: Object.keys(data) });
    this.log("info", "Migrated to", to);
  }

  private createAdapter(type: string): StorageAdapter {
    switch (type) {
      case "chrome": return new ChromeStorageAdapter("local");
      case "indexeddb": return new IndexedDBStorageAdapter();
      case "memory": return new MemoryStorageAdapter(50);
      default: return new ChromeStorageAdapter("local");
    }
  }
}

export const STORAGE_KEYS_REF = STORAGE_KEYS;
