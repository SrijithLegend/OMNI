/**
 * Notes Engine — Manages markdown notes with auto-save and version history.
 *
 * Responsibilities:
 * - CRUD operations for notes
 * - Auto-save with debouncing
 * - Version history tracking
 * - Word count and reading time calculation
 * - Folder organization
 * - Search indexing
 */

import { BaseEngine, type HealthStatus } from "./base";
import type { UUID } from "../types/omni";
import type { Note, NoteVersion, NoteFilter, Folder } from "../models/workspace";
import { createEmptyNote, createFolder, calculateReadingTime } from "../models/workspace";

// ============== CONSTANTS ==============

const NOTE_STORE_NAME = "omni_notes";
const NOTE_VERSION_STORE_NAME = "omni_note_versions";
const FOLDER_STORE_NAME = "omni_folders";
const NOTE_FOLDER_STORE_NAME = "omni_note_folders";

const AUTOSAVE_DELAY = 2000; // 2 seconds
const VERSION_HISTORY_LIMIT = 50; // Keep last 50 versions

// ============== INTERFACES ==============

export interface NotesConfig {
  autosave: boolean;
  autosaveDelay: number;
  versionHistory: boolean;
  versionHistoryLimit: number;
}

export interface NoteUpdateData {
  title?: string;
  content?: string;
  folderId?: UUID | null;
  tags?: string[];
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  deletedAt?: number | null;
}

// ============== NOTES ENGINE ==============

export class NotesEngine extends BaseEngine {
  private db: IDBDatabase | null = null;
  private config: NotesConfig;
  private pendingAutosaves: Map<UUID, ReturnType<typeof setTimeout>> = new Map();
  private noteCache: Map<UUID, Note> = new Map();

  constructor(config?: Partial<NotesConfig>) {
    super({ name: "NotesEngine", version: "1.0.0", debug: false });
    this.config = {
      autosave: config?.autosave ?? true,
      autosaveDelay: config?.autosaveDelay || AUTOSAVE_DELAY,
      versionHistory: config?.versionHistory ?? true,
      versionHistoryLimit: config?.versionHistoryLimit || VERSION_HISTORY_LIMIT,
    };
  }

  async start(): Promise<void> {
    this.isRunning = true;
    await this.initDatabase();
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    // Flush pending autosaves
    for (const [noteId, timeout] of this.pendingAutosaves) {
      clearTimeout(timeout);
      await this.flushAutosave(noteId);
    }

    this.db = null;
  }

  async health(): Promise<HealthStatus> {
    return {
      ok: this.db !== null,
      message: this.db ? "Notes Engine ready" : "Database not initialized",
      timestamp: Date.now(),
    };
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("OmniNotes", 1);

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

        // Notes store
        if (!db.objectStoreNames.contains(NOTE_STORE_NAME)) {
          const noteStore = db.createObjectStore(NOTE_STORE_NAME, { keyPath: "id" });
          noteStore.createIndex("projectId", "projectId", { unique: false });
          noteStore.createIndex("folderId", "folderId", { unique: false });
          noteStore.createIndex("isDeleted", "isDeleted", { unique: false });
          noteStore.createIndex("isFavorite", "isFavorite", { unique: false });
          noteStore.createIndex("isPinned", "isPinned", { unique: false });
          noteStore.createIndex("isArchived", "isArchived", { unique: false });
        }

        // Note versions store
        if (!db.objectStoreNames.contains(NOTE_VERSION_STORE_NAME)) {
          const versionStore = db.createObjectStore(NOTE_VERSION_STORE_NAME, { keyPath: "id" });
          versionStore.createIndex("noteId", "noteId", { unique: false });
        }

        // Note folders store
        if (!db.objectStoreNames.contains(NOTE_FOLDER_STORE_NAME)) {
          const folderStore = db.createObjectStore(NOTE_FOLDER_STORE_NAME, { keyPath: "id" });
          folderStore.createIndex("projectId", "projectId", { unique: false });
          folderStore.createIndex("parentId", "parentId", { unique: false });
        }
      };
    });
  }

  // ============== NOTE OPERATIONS ==============

  async createNote(projectId: UUID, title = "Untitled Note"): Promise<Note> {
    const note = createEmptyNote(projectId, title);
    await this.saveNote(note);
    this.emit("note:created", { note });
    return note;
  }

  async getNote(noteId: UUID): Promise<Note | null> {
    // Check cache first
    if (this.noteCache.has(noteId)) {
      return this.noteCache.get(noteId) || null;
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_STORE_NAME, "readonly");
      const store = transaction.objectStore(NOTE_STORE_NAME);
      const request = store.get(noteId);

      request.onsuccess = () => {
        const note = request.result || null;
        if (note) {
          this.noteCache.set(noteId, note);
        }
        resolve(note);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateNote(noteId: UUID, data: NoteUpdateData): Promise<Note | null> {
    const note = await this.getNote(noteId);
    if (!note) return null;

    const updatedNote: Note = {
      ...note,
      ...data,
      updatedAt: Date.now(),
    };

    // Recalculate stats if content changed
    if (data.content !== undefined) {
      updatedNote.charCount = data.content.length;
      updatedNote.wordCount = this.countWords(data.content);
      updatedNote.readingTime = calculateReadingTime(updatedNote.wordCount);
    }

    // Save version history if content changed and version history is enabled
    if (this.config.versionHistory && data.content !== undefined && data.content !== note.content) {
      await this.saveVersion(noteId, note);
    }

    await this.saveNote(updatedNote);

    // Update cache
    this.noteCache.set(noteId, updatedNote);

    this.emit("note:updated", { note: updatedNote });

    return updatedNote;
  }

  async deleteNote(noteId: UUID, permanent = false): Promise<boolean> {
    const note = await this.getNote(noteId);
    if (!note) return false;

    if (permanent) {
      // Delete all versions
      await this.deleteNoteVersions(noteId);

      // Delete note record
      await this.deleteNoteRecord(noteId);

      // Remove from cache
      this.noteCache.delete(noteId);

      this.emit("note:deleted", { noteId, permanent: true });
    } else {
      // Soft delete
      await this.updateNote(noteId, { isDeleted: true });
      this.emit("note:deleted", { noteId, permanent: false });
    }

    return true;
  }

  async restoreNote(noteId: UUID): Promise<Note | null> {
    return this.updateNote(noteId, { isDeleted: false, isArchived: false });
  }

  async archiveNote(noteId: UUID): Promise<Note | null> {
    this.emit("note:archived", { noteId });
    return this.updateNote(noteId, { isArchived: true });
  }

  async unarchiveNote(noteId: UUID): Promise<Note | null> {
    return this.updateNote(noteId, { isArchived: false });
  }

  async toggleFavorite(noteId: UUID): Promise<Note | null> {
    const note = await this.getNote(noteId);
    if (!note) return null;

    return this.updateNote(noteId, { isFavorite: !note.isFavorite });
  }

  async togglePinned(noteId: UUID): Promise<Note | null> {
    const note = await this.getNote(noteId);
    if (!note) return null;

    return this.updateNote(noteId, { isPinned: !note.isPinned });
  }

  async moveNote(noteId: UUID, folderId: UUID | null): Promise<Note | null> {
    return this.updateNote(noteId, { folderId });
  }

  // ============== AUTOSAVE ==============

  scheduleAutosave(noteId: UUID, content: string): void {
    if (!this.config.autosave) return;

    // Clear existing timeout
    const existing = this.pendingAutosaves.get(noteId);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule new save
    const timeout = setTimeout(async () => {
      await this.updateNote(noteId, { content });
      await this.markAutoSaved(noteId);
    }, this.config.autosaveDelay);

    this.pendingAutosaves.set(noteId, timeout);
  }

  async flushAutosave(noteId: UUID): Promise<void> {
    const timeout = this.pendingAutosaves.get(noteId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingAutosaves.delete(noteId);
    }
  }

  private async markAutoSaved(noteId: UUID): Promise<void> {
    const note = await this.getNote(noteId);
    if (!note) return;

    await this.saveNote({
      ...note,
      lastAutoSavedAt: Date.now(),
    });
  }

  // ============== NOTE QUERIES ==============

  async listNotes(projectId: UUID, filter?: NoteFilter): Promise<Note[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_STORE_NAME, "readonly");
      const store = transaction.objectStore(NOTE_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        let notes = request.result as Note[];

        // Apply filters
        if (filter) {
          // Exclude deleted by default
          if (filter.isDeleted === undefined) {
            notes = notes.filter(n => !n.isDeleted);
          }

          if (filter.folderId !== undefined) {
            notes = notes.filter(n => n.folderId === filter.folderId);
          }

          if (filter.tags?.length) {
            notes = notes.filter(n => n.tags.some(t => filter.tags!.includes(t)));
          }

          if (filter.isFavorite !== undefined) {
            notes = notes.filter(n => n.isFavorite === filter.isFavorite);
          }

          if (filter.isArchived !== undefined) {
            notes = notes.filter(n => n.isArchived === filter.isArchived);
          }

          if (filter.search) {
            const search = filter.search.toLowerCase();
            notes = notes.filter(n =>
              n.title.toLowerCase().includes(search) ||
              n.content.toLowerCase().includes(search) ||
              n.tags.some(t => t.toLowerCase().includes(search))
            );
          }

          // Sort
          const sortField = filter.sortBy || "updatedAt";
          const sortOrder = filter.sortOrder || "desc";

          notes.sort((a, b) => {
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
              case "wordCount":
                aVal = a.wordCount;
                bVal = b.wordCount;
                break;
            }

            if (sortOrder === "asc") {
              return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
              return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
          });
        }

        resolve(notes);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getRecentNotes(projectId: UUID, limit = 10): Promise<Note[]> {
    const notes = await this.listNotes(projectId, {
      sortBy: "updatedAt",
      sortOrder: "desc",
    });

    return notes.slice(0, limit);
  }

  async getFavoriteNotes(projectId: UUID): Promise<Note[]> {
    return this.listNotes(projectId, { isFavorite: true });
  }

  async getPinnedNotes(projectId: UUID): Promise<Note[]> {
    const notes = await this.listNotes(projectId);
    return notes.filter(n => n.isPinned);
  }

  async getArchivedNotes(projectId: UUID): Promise<Note[]> {
    return this.listNotes(projectId, { isArchived: true });
  }

  async searchNotes(projectId: UUID, query: string): Promise<Note[]> {
    return this.listNotes(projectId, { search: query });
  }

  // ============== VERSION HISTORY ==============

  async getVersions(noteId: UUID, limit = 10): Promise<NoteVersion[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_VERSION_STORE_NAME, "readonly");
      const store = transaction.objectStore(NOTE_VERSION_STORE_NAME);
      const index = store.index("noteId");
      const request = index.getAll(noteId);

      request.onsuccess = () => {
        const versions = (request.result as NoteVersion[])
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, limit);
        resolve(versions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getVersion(versionId: UUID): Promise<NoteVersion | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_VERSION_STORE_NAME, "readonly");
      const store = transaction.objectStore(NOTE_VERSION_STORE_NAME);
      const request = store.get(versionId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async restoreVersion(noteId: UUID, versionId: UUID): Promise<Note | null> {
    const version = await this.getVersion(versionId);
    if (!version || version.noteId !== noteId) return null;

    return this.updateNote(noteId, { content: version.content });
  }

  async deleteVersions(noteId: UUID, keepCount = 10): Promise<void> {
    const versions = await this.getVersions(noteId, 1000);
    const toDelete = versions.slice(keepCount);

    for (const version of toDelete) {
      await this.deleteVersion(version.id);
    }
  }

  // ============== FOLDER OPERATIONS ==============

  async createFolder(projectId: UUID, name: string, parentId: UUID | null = null): Promise<Folder> {
    const folder = createFolder(projectId, name, parentId);

    // Calculate path
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

      const transaction = this.db.transaction(NOTE_FOLDER_STORE_NAME, "readonly");
      const store = transaction.objectStore(NOTE_FOLDER_STORE_NAME);
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

      const transaction = this.db.transaction(NOTE_FOLDER_STORE_NAME, "readonly");
      const store = transaction.objectStore(NOTE_FOLDER_STORE_NAME);
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

  async deleteFolder(folderId: UUID, permanent = false): Promise<boolean> {
    const folder = await this.getFolder(folderId);
    if (!folder) return false;

    if (permanent) {
      await this.deleteFolderRecord(folderId);
      this.emit("folder:deleted", { folderId, permanent: true });
    } else {
      await this.updateFolder(folderId, { isDeleted: true });
      this.emit("folder:deleted", { folderId, permanent: false });
    }

    return true;
  }

  // ============== STATISTICS ==============

  async getNoteStats(projectId: UUID): Promise<{
    total: number;
    totalWords: number;
    totalChars: number;
    favoriteCount: number;
    pinnedCount: number;
    archivedCount: number;
  }> {
    const notes = await this.listNotes(projectId);

    return {
      total: notes.filter(n => !n.isArchived).length,
      totalWords: notes.reduce((sum, n) => sum + n.wordCount, 0),
      totalChars: notes.reduce((sum, n) => sum + n.charCount, 0),
      favoriteCount: notes.filter(n => n.isFavorite).length,
      pinnedCount: notes.filter(n => n.isPinned).length,
      archivedCount: notes.filter(n => n.isArchived).length,
    };
  }

  // ============== PRIVATE HELPERS ==============

  private countWords(content: string): number {
    // Remove markdown syntax and count words
    const cleanContent = content
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/`[^`]+`/g, "") // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Extract link text
      .replace(/[#*_~>`-]/g, "") // Remove markdown chars
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanContent) return 0;
    return cleanContent.split(/\s+/).filter(w => w.length > 0).length;
  }

  private async saveNote(note: Note): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_STORE_NAME, "readwrite");
      const store = transaction.objectStore(NOTE_STORE_NAME);
      const request = store.put(note);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveVersion(noteId: UUID, note: Note): Promise<void> {
    const version: NoteVersion = {
      id: crypto.randomUUID(),
      noteId,
      content: note.content,
      wordCount: note.wordCount,
      version: note.version,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_VERSION_STORE_NAME, "readwrite");
      const store = transaction.objectStore(NOTE_VERSION_STORE_NAME);
      const request = store.add(version);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteNoteRecord(noteId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_STORE_NAME, "readwrite");
      const store = transaction.objectStore(NOTE_STORE_NAME);
      const request = store.delete(noteId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteNoteVersions(noteId: UUID): Promise<void> {
    const versions = await this.getVersions(noteId, 1000);

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_VERSION_STORE_NAME, "readwrite");
      const store = transaction.objectStore(NOTE_VERSION_STORE_NAME);

      for (const version of versions) {
        store.delete(version.id);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async deleteVersion(versionId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_VERSION_STORE_NAME, "readwrite");
      const store = transaction.objectStore(NOTE_VERSION_STORE_NAME);
      const request = store.delete(versionId);

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

      const transaction = this.db.transaction(NOTE_FOLDER_STORE_NAME, "readwrite");
      const store = transaction.objectStore(NOTE_FOLDER_STORE_NAME);
      const request = store.put(folder);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async updateFolder(folderId: UUID, updates: Partial<Folder>): Promise<Folder | null> {
    const folder = await this.getFolder(folderId);
    if (!folder) return null;

    const updatedFolder: Folder = {
      ...folder,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.saveFolder(updatedFolder);
    this.emit("folder:updated", { folder: updatedFolder });

    return updatedFolder;
  }

  private async deleteFolderRecord(folderId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(NOTE_FOLDER_STORE_NAME, "readwrite");
      const store = transaction.objectStore(NOTE_FOLDER_STORE_NAME);
      const request = store.delete(folderId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
