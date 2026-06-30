/**
 * Storage Adapter — Abstract interface for all storage backends.
 *
 * Every storage implementation (Chrome, IndexedDB, Memory, Cloud) must conform to this.
 * The Storage Engine never calls storage directly — only through adapters.
 */

export interface StorageAdapter {
  readonly name: string;
  readonly isAvailable: boolean;

  /** Connect to the storage backend. */
  connect(): Promise<void>;

  /** Disconnect and clean up. */
  disconnect(): Promise<void>;

  /** Get a single value. */
  get<T>(key: string): Promise<T | null>;

  /** Get multiple values. */
  getMany<T extends Record<string, unknown>>(keys: string[]): Promise<Partial<T>>;

  /** Set a single value. */
  set<T>(key: string, value: T): Promise<void>;

  /** Set multiple values. */
  setMany<T extends Record<string, unknown>>(values: Partial<T>): Promise<void>;

  /** Remove a single value. */
  remove(key: string): Promise<void>;

  /** Remove multiple values. */
  removeMany(keys: string[]): Promise<void>;

  /** Clear all data in this namespace. */
  clear(): Promise<void>;

  /** List all keys. */
  keys(): Promise<string[]>;

  /** Check if key exists. */
  has(key: string): Promise<boolean>;

  /** Health check. */
  health(): Promise<{ ok: boolean; message: string; used?: number; quota?: number }>;
}
