/**
 * Snippets Engine — Manages code snippets, prompts, and templates.
 *
 * Responsibilities:
 * - CRUD operations for snippets
 * - Language detection
 * - Syntax highlighting support
 * - Copy/insert functionality
 * - Usage tracking
 * - Organization (folders, tags)
 */

import { BaseEngine, type HealthStatus } from "./base";
import type { UUID } from "../types/omni";
import type { Snippet, SnippetType, SnippetFilter, Folder } from "../models/workspace";
import { createEmptySnippet, createFolder, detectLanguage } from "../models/workspace";

// ============== CONSTANTS ==============

const SNIPPET_STORE_NAME = "omni_snippets";
const FOLDER_STORE_NAME = "omni_snippet_folders";

// ============== INTERFACES ==============

export interface SnippetsConfig {
  defaultLanguage: string;
  defaultType: SnippetType;
  maxRecentSnippets: number;
}

export interface SnippetUpdateData {
  title?: string;
  code?: string;
  language?: string;
  type?: SnippetType;
  folderId?: UUID | null;
  tags?: string[];
  isFavorite?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
  useCount?: number;
  lastUsedAt?: number | null;
}

// ============== SNIPPETS ENGINE ==============

export class SnippetsEngine extends BaseEngine {
  private db: IDBDatabase | null = null;
  private config: SnippetsConfig;

  constructor(config?: Partial<SnippetsConfig>) {
    super({ name: "SnippetsEngine", version: "1.0.0", debug: false });
    this.config = {
      defaultLanguage: config?.defaultLanguage || "text",
      defaultType: config?.defaultType || "code",
      maxRecentSnippets: config?.maxRecentSnippets || 20,
    };
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
      message: this.db ? "Snippets Engine ready" : "Database not initialized",
      timestamp: Date.now(),
    };
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("OmniSnippets", 1);

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

        // Snippets store
        if (!db.objectStoreNames.contains(SNIPPET_STORE_NAME)) {
          const snippetStore = db.createObjectStore(SNIPPET_STORE_NAME, { keyPath: "id" });
          snippetStore.createIndex("projectId", "projectId", { unique: false });
          snippetStore.createIndex("folderId", "folderId", { unique: false });
          snippetStore.createIndex("type", "type", { unique: false });
          snippetStore.createIndex("language", "language", { unique: false });
          snippetStore.createIndex("isDeleted", "isDeleted", { unique: false });
          snippetStore.createIndex("isFavorite", "isFavorite", { unique: false });
          snippetStore.createIndex("isPinned", "isPinned", { unique: false });
          snippetStore.createIndex("lastUsedAt", "lastUsedAt", { unique: false });
        }

        // Folders store
        if (!db.objectStoreNames.contains(FOLDER_STORE_NAME)) {
          const folderStore = db.createObjectStore(FOLDER_STORE_NAME, { keyPath: "id" });
          folderStore.createIndex("projectId", "projectId", { unique: false });
          folderStore.createIndex("parentId", "parentId", { unique: false });
        }
      };
    });
  }

  // ============== SNIPPET OPERATIONS ==============

  async createSnippet(
    projectId: UUID,
    title: string,
    code: string,
    type?: SnippetType,
    language?: string
  ): Promise<Snippet> {
    const snippet = createEmptySnippet(projectId, title);
    snippet.code = code;
    snippet.type = type || this.config.defaultType;

    // Auto-detect language if not provided
    snippet.language = language || detectLanguage(code) || this.config.defaultLanguage;

    await this.saveSnippet(snippet);
    this.emit("snippet:created", { snippet });

    return snippet;
  }

  async getSnippet(snippetId: UUID): Promise<Snippet | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(SNIPPET_STORE_NAME, "readonly");
      const store = transaction.objectStore(SNIPPET_STORE_NAME);
      const request = store.get(snippetId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateSnippet(snippetId: UUID, data: SnippetUpdateData): Promise<Snippet | null> {
    const snippet = await this.getSnippet(snippetId);
    if (!snippet) return null;

    const updatedSnippet: Snippet = {
      ...snippet,
      ...data,
      updatedAt: Date.now(),
    };

    // Auto-detect language if code changed and no language provided
    if (data.code && !data.language) {
      updatedSnippet.language = detectLanguage(data.code) || snippet.language;
    }

    await this.saveSnippet(updatedSnippet);
    this.emit("snippet:updated", { snippet: updatedSnippet });

    return updatedSnippet;
  }

  async deleteSnippet(snippetId: UUID, permanent = false): Promise<boolean> {
    const snippet = await this.getSnippet(snippetId);
    if (!snippet) return false;

    if (permanent) {
      await this.deleteSnippetRecord(snippetId);
      this.emit("snippet:deleted", { snippetId, permanent: true });
    } else {
      await this.updateSnippet(snippetId, { isDeleted: true });
      this.emit("snippet:deleted", { snippetId, permanent: false });
    }

    return true;
  }

  async restoreSnippet(snippetId: UUID): Promise<Snippet | null> {
    return this.updateSnippet(snippetId, { isDeleted: false });
  }

  async duplicateSnippet(snippetId: UUID, newName?: string): Promise<Snippet | null> {
    const original = await this.getSnippet(snippetId);
    if (!original) return null;

    const duplicate = await this.createSnippet(
      original.projectId,
      newName || `${original.title} (copy)`,
      original.code,
      original.type,
      original.language
    );

    // Copy other attributes
    await this.updateSnippet(duplicate.id, {
      folderId: original.folderId,
      tags: [...original.tags],
    });

    this.emit("snippet:duplicated", { original, duplicate });

    return duplicate;
  }

  async toggleFavorite(snippetId: UUID): Promise<Snippet | null> {
    const snippet = await this.getSnippet(snippetId);
    if (!snippet) return null;

    return this.updateSnippet(snippetId, { isFavorite: !snippet.isFavorite });
  }

  async togglePinned(snippetId: UUID): Promise<Snippet | null> {
    const snippet = await this.getSnippet(snippetId);
    if (!snippet) return null;

    return this.updateSnippet(snippetId, { isPinned: !snippet.isPinned });
  }

  // ============== COPY/USE OPERATIONS ==============

  async copySnippet(snippetId: UUID): Promise<string | null> {
    const snippet = await this.getSnippet(snippetId);
    if (!snippet) return null;

    try {
      await navigator.clipboard.writeText(snippet.code);

      // Track usage
      await this.updateSnippet(snippetId, {
        useCount: snippet.useCount + 1,
        lastUsedAt: Date.now(),
      });

      this.emit("snippet:copied", { snippet });

      return snippet.code;
    } catch (error) {
      this.emit("error", { error, context: "copySnippet" });
      return null;
    }
  }

  async useSnippet(snippetId: UUID): Promise<string | null> {
    // Same as copy but with different event
    const code = await this.copySnippet(snippetId);
    if (code) {
      this.emit("snippet:used", { snippetId });
    }
    return code;
  }

  // ============== SNIPPET QUERIES ==============

  async listSnippets(projectId: UUID, filter?: SnippetFilter): Promise<Snippet[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(SNIPPET_STORE_NAME, "readonly");
      const store = transaction.objectStore(SNIPPET_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        let snippets = request.result as Snippet[];

        // Apply filters
        if (filter) {
          // Exclude deleted by default
          if (filter.isDeleted === undefined) {
            snippets = snippets.filter(s => !s.isDeleted);
          }

          if (filter.type?.length) {
            snippets = snippets.filter(s => filter.type!.includes(s.type));
          }

          if (filter.language?.length) {
            snippets = snippets.filter(s => filter.language!.includes(s.language));
          }

          if (filter.folderId !== undefined) {
            snippets = snippets.filter(s => s.folderId === filter.folderId);
          }

          if (filter.tags?.length) {
            snippets = snippets.filter(s => s.tags.some(t => filter.tags!.includes(t)));
          }

          if (filter.isFavorite !== undefined) {
            snippets = snippets.filter(s => s.isFavorite === filter.isFavorite);
          }

          if (filter.search) {
            const search = filter.search.toLowerCase();
            snippets = snippets.filter(s =>
              s.title.toLowerCase().includes(search) ||
              s.code.toLowerCase().includes(search) ||
              s.tags.some(t => t.toLowerCase().includes(search))
            );
          }

          // Sort
          const sortField = filter.sortBy || "updatedAt";
          const sortOrder = filter.sortOrder || "desc";

          snippets.sort((a, b) => {
            let aVal: string | number = 0;
            let bVal: string | number = 0;

            switch (sortField) {
              case "title":
                aVal = a.title.toLowerCase();
                bVal = b.title.toLowerCase();
                break;
              case "createdAt":
                aVal = a.createdAt;
                bVal = b.createdAt;
                break;
              case "updatedAt":
                aVal = a.updatedAt;
                bVal = b.updatedAt;
                break;
              case "useCount":
                aVal = a.useCount;
                bVal = b.useCount;
                break;
              case "lastUsedAt":
                aVal = a.lastUsedAt || 0;
                bVal = b.lastUsedAt || 0;
                break;
            }

            if (sortOrder === "asc") {
              return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
              return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
          });
        }

        resolve(snippets);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getRecentSnippets(projectId: UUID, limit?: number): Promise<Snippet[]> {
    const snippets = await this.listSnippets(projectId, {
      sortBy: "lastUsedAt",
      sortOrder: "desc",
    });

    // Filter to only those that have been used
    return snippets
      .filter(s => s.lastUsedAt !== null)
      .slice(0, limit || this.config.maxRecentSnippets);
  }

  async getFavoriteSnippets(projectId: UUID): Promise<Snippet[]> {
    return this.listSnippets(projectId, { isFavorite: true });
  }

  async getPinnedSnippets(projectId: UUID): Promise<Snippet[]> {
    const snippets = await this.listSnippets(projectId);
    return snippets.filter(s => s.isPinned);
  }

  async getSnippetsByType(projectId: UUID, type: SnippetType): Promise<Snippet[]> {
    return this.listSnippets(projectId, { type: [type] });
  }

  async getSnippetsByLanguage(projectId: UUID, language: string): Promise<Snippet[]> {
    return this.listSnippets(projectId, { language: [language] });
  }

  async searchSnippets(projectId: UUID, query: string): Promise<Snippet[]> {
    return this.listSnippets(projectId, { search: query });
  }

  // ============== STATISTICS ==============

  async getStats(projectId: UUID): Promise<{
    total: number;
    byType: Record<SnippetType, number>;
    byLanguage: Record<string, number>;
    favoritesCount: number;
    pinnedCount: number;
    totalUseCount: number;
  }> {
    const snippets = await this.listSnippets(projectId);

    const byType: Record<SnippetType, number> = {
      code: 0,
      prompt: 0,
      template: 0,
      command: 0,
      markdown: 0,
      json: 0,
      shell: 0,
      sql: 0,
    };

    const byLanguage: Record<string, number> = {};

    for (const snippet of snippets) {
      byType[snippet.type] = (byType[snippet.type] || 0) + 1;
      byLanguage[snippet.language] = (byLanguage[snippet.language] || 0) + 1;
    }

    return {
      total: snippets.length,
      byType,
      byLanguage,
      favoritesCount: snippets.filter(s => s.isFavorite).length,
      pinnedCount: snippets.filter(s => s.isPinned).length,
      totalUseCount: snippets.reduce((sum, s) => sum + s.useCount, 0),
    };
  }

  // ============== FOLDER OPERATIONS ==============

  async createFolder(projectId: UUID, name: string, parentId: UUID | null = null): Promise<Folder> {
    const folder = createFolder(projectId, name, parentId);

    if (parentId) {
      const parent = await this.getFolder(parentId);
      if (parent) {
        folder.path = `${parent.path}${name}/`;
      }
    }

    await this.saveFolder(folder);
    this.emit("folder:created", { folder });

    return folder;
  }

  async getFolder(folderId: UUID): Promise<Folder | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FOLDER_STORE_NAME, "readonly");
      const store = transaction.objectStore(FOLDER_STORE_NAME);
      const request = store.get(folderId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listFolders(projectId: UUID, parentId: UUID | null = null): Promise<Folder[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FOLDER_STORE_NAME, "readonly");
      const store = transaction.objectStore(FOLDER_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const folders = (request.result as Folder[])
          .filter(f => f.parentId === parentId && !f.isDeleted);
        resolve(folders);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ============== IMPORT/EXPORT ==============

  async importSnippet(projectId: UUID, data: {
    title: string;
    code: string;
    type?: SnippetType;
    language?: string;
    tags?: string[];
  }): Promise<Snippet> {
    return this.createSnippet(
      projectId,
      data.title,
      data.code,
      data.type,
      data.language
    );
  }

  async exportSnippet(snippetId: UUID): Promise<{
    title: string;
    code: string;
    type: SnippetType;
    language: string;
    tags: string[];
  } | null> {
    const snippet = await this.getSnippet(snippetId);
    if (!snippet) return null;

    return {
      title: snippet.title,
      code: snippet.code,
      type: snippet.type,
      language: snippet.language,
      tags: snippet.tags,
    };
  }

  // ============== PRIVATE HELPERS ==============

  private async saveSnippet(snippet: Snippet): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(SNIPPET_STORE_NAME, "readwrite");
      const store = transaction.objectStore(SNIPPET_STORE_NAME);
      const request = store.put(snippet);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteSnippetRecord(snippetId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(SNIPPET_STORE_NAME, "readwrite");
      const store = transaction.objectStore(SNIPPET_STORE_NAME);
      const request = store.delete(snippetId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveFolder(folder: Folder): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FOLDER_STORE_NAME, "readwrite");
      const store = transaction.objectStore(FOLDER_STORE_NAME);
      const request = store.put(folder);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
