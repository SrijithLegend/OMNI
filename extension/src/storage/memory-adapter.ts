/**
 * MemoryStorageAdapter — In-memory storage with TTL and size limits.
 *
 * Used for caching, testing, and ephemeral data.
 * Falls back when Chrome/IndexedDB is unavailable.
 */

import type { StorageAdapter } from "./adapter";

interface MemoryEntry<T> {
  value: T;
  expiresAt: number | null;
  size: number;
}

export class MemoryStorageAdapter implements StorageAdapter {
  readonly name = "memory";
  isAvailable = true;
  private store = new Map<string, MemoryEntry<unknown>>();
  private maxSize: number;
  private currentSize = 0;

  constructor(maxSizeMB = 10) {
    this.maxSize = maxSizeMB * 1024 * 1024;
  }

  async connect(): Promise<void> {
    this.isAvailable = true;
  }

  async disconnect(): Promise<void> {
    this.store.clear();
    this.currentSize = 0;
    this.isAvailable = false;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.currentSize -= entry.size;
      return null;
    }
    return entry.value as T;
  }

  async getMany<T extends Record<string, unknown>>(keys: string[]): Promise<Partial<T>> {
    const result: Partial<T> = {};
    for (const key of keys) {
      const value = await this.get<unknown>(key);
      if (value !== null) (result as Record<string, unknown>)[key] = value;
    }
    return result;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const size = JSON.stringify(value).length;
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;

    // Evict oldest entries if over limit
    while (this.currentSize + size > this.maxSize && this.store.size > 0) {
      const oldest = this.store.keys().next().value;
      if (oldest) {
        const old = this.store.get(oldest);
        if (old) this.currentSize -= old.size;
        this.store.delete(oldest);
      }
    }

    const old = this.store.get(key);
    if (old) this.currentSize -= old.size;

    this.store.set(key, { value, expiresAt, size });
    this.currentSize += size;
  }

  async setMany<T extends Record<string, unknown>>(values: Partial<T>): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await this.set(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.store.delete(key);
    }
  }

  async removeMany(keys: string[]): Promise<void> {
    for (const key of keys) await this.remove(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.currentSize = 0;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.currentSize -= entry.size;
      return false;
    }
    return true;
  }

  async health(): Promise<{ ok: boolean; message: string; used?: number; quota?: number }> {
    return {
      ok: true,
      message: `Memory: ${this.store.size} keys, ${this.currentSize} bytes / ${this.maxSize} bytes`,
      used: this.currentSize,
      quota: this.maxSize,
    };
  }
}
