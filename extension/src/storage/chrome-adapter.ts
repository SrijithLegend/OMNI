/**
 * ChromeStorageAdapter — Storage via chrome.storage API.
 *
 * Supports local, sync, session, and managed storage areas.
 * Automatically handles area selection based on config.
 */

import type { StorageAdapter } from "./adapter";

type ChromeArea = chrome.storage.LocalStorageArea | chrome.storage.SessionStorageArea | chrome.storage.SyncStorageArea;

export class ChromeStorageAdapter implements StorageAdapter {
  readonly name = "chrome";
  isAvailable = true;
  private area: ChromeArea;
  private connected = false;

  constructor(areaName: "local" | "sync" | "session" | "managed" = "local") {
    const areas = chrome.storage;
    this.area = areaName === "session"
      ? areas.session
      : areaName === "sync"
        ? areas.sync
        : areas.local;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async get<T>(key: string): Promise<T | null> {
    const result = await this.area.get(key);
    return result[key] ?? null;
  }

  async getMany<T extends Record<string, unknown>>(keys: string[]): Promise<Partial<T>> {
    const result = await this.area.get(keys);
    return result as Partial<T>;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.area.set({ [key]: value });
  }

  async setMany<T extends Record<string, unknown>>(values: Partial<T>): Promise<void> {
    await this.area.set(values);
  }

  async remove(key: string): Promise<void> {
    await this.area.remove(key);
  }

  async removeMany(keys: string[]): Promise<void> {
    await this.area.remove(keys);
  }

  async clear(): Promise<void> {
    await this.area.clear();
  }

  async keys(): Promise<string[]> {
    const result = await this.area.get();
    return Object.keys(result);
  }

  async has(key: string): Promise<boolean> {
    const result = await this.area.get(key);
    return result[key] !== undefined;
  }

  async health(): Promise<{ ok: boolean; message: string; used?: number; quota?: number }> {
    try {
      const result = await this.area.get();
      const keys = Object.keys(result);
      const bytes = JSON.stringify(result).length;
      return {
        ok: true,
        message: `Chrome storage: ${keys.length} keys, ${bytes} bytes`,
        used: bytes,
      };
    } catch (err) {
      return { ok: false, message: `Chrome storage error: ${err}` };
    }
  }
}
