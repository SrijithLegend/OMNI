/**
 * IndexedDBStorageAdapter — Large-object storage via IndexedDB.
 *
 * Used for conversations, files, backups, and anything >1MB.
 * Implements a single object store with key-value pairs.
 */

import type { StorageAdapter } from "./adapter";

const DB_NAME = "omni_storage";
const DB_VERSION = 1;
const STORE_NAME = "data";

export class IndexedDBStorageAdapter implements StorageAdapter {
  readonly name = "indexeddb";
  isAvailable = false;
  private db: IDBDatabase | null = null;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(new Error("IndexedDB open failed"));
      request.onsuccess = () => {
        this.db = request.result;
        this.isAvailable = true;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    this.db?.close();
    this.db = null;
    this.isAvailable = false;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.runTx<T | null>("readonly", (store) => {
      return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getMany<T extends Record<string, unknown>>(keys: string[]): Promise<Partial<T>> {
    const result: Partial<T> = {};
    for (const key of keys) {
      const value = await this.get<T[keyof T]>(key);
      if (value !== null) (result as Record<string, unknown>)[key] = value;
    }
    return result;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.runTx("readwrite", (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async setMany<T extends Record<string, unknown>>(values: Partial<T>): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await this.set(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    await this.runTx("readwrite", (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async removeMany(keys: string[]): Promise<void> {
    for (const key of keys) await this.remove(key);
  }

  async clear(): Promise<void> {
    await this.runTx("readwrite", (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async keys(): Promise<string[]> {
    return this.runTx("readonly", (store) => {
      return new Promise<string[]>((resolve, reject) => {
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result as string[]);
        req.onerror = () => reject(req.error);
      });
    });
  }

  async has(key: string): Promise<boolean> {
    const result = await this.runTx("readonly", (store) => {
      return new Promise<boolean>((resolve, reject) => {
        const req = store.count(key);
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => reject(req.error);
      });
    });
    return result;
  }

  async health(): Promise<{ ok: boolean; message: string; used?: number; quota?: number }> {
    try {
      const keys = await this.keys();
      let total = 0;
      for (const key of keys) {
        const value = await this.get(key);
        total += JSON.stringify(value).length;
      }
      return {
        ok: true,
        message: `IndexedDB: ${keys.length} keys, ${total} bytes`,
        used: total,
      };
    } catch (err) {
      return { ok: false, message: `IndexedDB error: ${err}` };
    }
  }

  private runTx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error("IndexedDB not connected");
    const tx = this.db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    return fn(store);
  }
}
