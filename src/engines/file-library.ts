/**
 * File Library Engine — Manages file storage, organization, and preview.
 *
 * Responsibilities:
 * - File upload and storage (IndexedDB, future: cloud)
 * - File organization (folders, tags)
 * - Preview generation
 * - Search indexing
 * - Storage usage tracking
 */

import { BaseEngine, type HealthStatus } from "./base";
import type { UUID, Timestamp } from "../types/omni";
import type {
  WorkspaceFile,
  Folder,
  FileFilter,
  FilePreview,
  PreviewType,
  StorageUsage,
} from "../models/workspace";
import {
  createEmptyFile,
  createFolder,
  getPreviewType,
  getMimeFromExtension,
  isImageFile,
  formatFileSize,
} from "../models/workspace";

// ============== CONSTANTS ==============

const FILE_STORE_NAME = "omni_files";
const FOLDER_STORE_NAME = "omni_folders";
const FILE_DATA_STORE_NAME = "omni_file_data";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_THUMBNAIL_SIZE = 200; // pixels
const MAX_PREVIEW_TEXT_SIZE = 64 * 1024; // 64 KB

// ============== INTERFACES ==============

export interface FileUploadOptions {
  file: File;
  projectId: UUID;
  folderId?: UUID | null;
  tags?: string[];
  description?: string;
  onProgress?: (progress: number) => void;
}

export interface FileLibraryConfig {
  maxFileSize: number;
  supportedExtensions: string[];
  enablePreview: boolean;
  enableThumbnails: boolean;
  thumbnailSize: number;
}

// ============== FILE LIBRARY ENGINE ==============

export class FileLibraryEngine extends BaseEngine {
  private db: IDBDatabase | null = null;
  private config: FileLibraryConfig;
  private storageCache: Map<UUID, number> = new Map();

  constructor(config?: Partial<FileLibraryConfig>) {
    super({ name: "FileLibraryEngine", version: "1.0.0", debug: false });
    this.config = {
      maxFileSize: config?.maxFileSize || MAX_FILE_SIZE,
      supportedExtensions: config?.supportedExtensions || [],
      enablePreview: config?.enablePreview ?? true,
      enableThumbnails: config?.enableThumbnails ?? true,
      thumbnailSize: config?.thumbnailSize || MAX_THUMBNAIL_SIZE,
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
      message: this.db ? "File Library ready" : "Database not initialized",
      timestamp: Date.now(),
    };
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("OmniFileLibrary", 1);

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

        // Files store
        if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
          const fileStore = db.createObjectStore(FILE_STORE_NAME, { keyPath: "id" });
          fileStore.createIndex("projectId", "projectId", { unique: false });
          fileStore.createIndex("folderId", "folderId", { unique: false });
          fileStore.createIndex("isDeleted", "isDeleted", { unique: false });
          fileStore.createIndex("isFavorite", "isFavorite", { unique: false });
          fileStore.createIndex("isPinned", "isPinned", { unique: false });
        }

        // Folders store
        if (!db.objectStoreNames.contains(FOLDER_STORE_NAME)) {
          const folderStore = db.createObjectStore(FOLDER_STORE_NAME, { keyPath: "id" });
          folderStore.createIndex("projectId", "projectId", { unique: false });
          folderStore.createIndex("parentId", "parentId", { unique: false });
        }

        // File data store (binary data)
        if (!db.objectStoreNames.contains(FILE_DATA_STORE_NAME)) {
          db.createObjectStore(FILE_DATA_STORE_NAME, { keyPath: "fileId" });
        }
      };
    });
  }

  // ============== FILE OPERATIONS ==============

  async uploadFile(options: FileUploadOptions): Promise<WorkspaceFile> {
    const { file, projectId, folderId = null, tags = [], description, onProgress } = options;

    // Validate file size
    if (file.size > this.config.maxFileSize) {
      throw new Error(`File too large. Maximum size is ${formatFileSize(this.config.maxFileSize)}`);
    }

    // Extract file info
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = file.type || getMimeFromExtension(extension);

    // Create file record
    const workspaceFile = createEmptyFile(projectId, {
      name: file.name,
      originalName: file.name,
      extension,
      mimeType,
      size: file.size,
      folderId,
      tags,
      description: description || null,
      storageType: "indexeddb",
      storagePath: `files/${projectId}/${crypto.randomUUID()}.${extension}`,
    });

    // Store file data
    const arrayBuffer = await file.arrayBuffer();

    await this.storeFileData(workspaceFile.id, arrayBuffer, onProgress);

    // Generate preview
    if (this.config.enablePreview) {
      await this.generatePreview(workspaceFile, arrayBuffer);
    }

    // Save file record
    await this.saveFile(workspaceFile);

    // Emit event
    this.emit("file:uploaded", { file: workspaceFile });

    return workspaceFile;
  }

  async getFile(fileId: UUID): Promise<WorkspaceFile | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FILE_STORE_NAME, "readonly");
      const store = transaction.objectStore(FILE_STORE_NAME);
      const request = store.get(fileId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getFileData(fileId: UUID): Promise<ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FILE_DATA_STORE_NAME, "readonly");
      const store = transaction.objectStore(FILE_DATA_STORE_NAME);
      const request = store.get(fileId);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.data || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateFile(fileId: UUID, updates: Partial<WorkspaceFile>): Promise<WorkspaceFile | null> {
    const file = await this.getFile(fileId);
    if (!file) return null;

    const updatedFile: WorkspaceFile = {
      ...file,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.saveFile(updatedFile);
    this.emit("file:updated", { file: updatedFile });

    return updatedFile;
  }

  async deleteFile(fileId: UUID, permanent = false): Promise<boolean> {
    const file = await this.getFile(fileId);
    if (!file) return false;

    if (permanent) {
      // Delete file data
      await this.deleteFileData(fileId);

      // Delete file record
      await this.deleteFileRecord(fileId);

      this.emit("file:deleted", { fileId, permanent: true });
    } else {
      // Soft delete
      await this.updateFile(fileId, { isDeleted: true, deletedAt: Date.now() });
      this.emit("file:deleted", { fileId, permanent: false });
    }

    return true;
  }

  async restoreFile(fileId: UUID): Promise<WorkspaceFile | null> {
    return this.updateFile(fileId, {
      isDeleted: false,
      deletedAt: null,
    });
  }

  async moveFile(fileId: UUID, folderId: UUID | null): Promise<WorkspaceFile | null> {
    return this.updateFile(fileId, { folderId });
  }

  async duplicateFile(fileId: UUID, newName?: string): Promise<WorkspaceFile | null> {
    const original = await this.getFile(fileId);
    if (!original) return null;

    const data = await this.getFileData(fileId);
    if (!data) return null;

    const duplicate = createEmptyFile(original.projectId, {
      name: newName || `${original.name} (copy)`,
      originalName: original.originalName,
      extension: original.extension,
      mimeType: original.mimeType,
      size: original.size,
      folderId: original.folderId,
      tags: [...original.tags],
      storageType: "indexeddb",
      storagePath: `files/${original.projectId}/${crypto.randomUUID()}.${original.extension}`,
    });

    await this.storeFileData(duplicate.id, data);
    await this.saveFile(duplicate);

    // Copy preview data
    if (original.previewText) {
      await this.updateFile(duplicate.id, {
        previewText: original.previewText,
        thumbnailUrl: original.thumbnailUrl,
      });
    }

    this.emit("file:duplicated", { original, duplicate });

    return duplicate;
  }

  async toggleFavorite(fileId: UUID): Promise<WorkspaceFile | null> {
    const file = await this.getFile(fileId);
    if (!file) return null;

    return this.updateFile(fileId, { isFavorite: !file.isFavorite });
  }

  async togglePinned(fileId: UUID): Promise<WorkspaceFile | null> {
    const file = await this.getFile(fileId);
    if (!file) return null;

    return this.updateFile(fileId, { isPinned: !file.isPinned });
  }

  async incrementViewCount(fileId: UUID): Promise<void> {
    const file = await this.getFile(fileId);
    if (!file) return;

    await this.updateFile(fileId, {
      viewCount: file.viewCount + 1,
      lastOpenedAt: Date.now(),
    });
  }

  async incrementDownloadCount(fileId: UUID): Promise<void> {
    const file = await this.getFile(fileId);
    if (!file) return;

    await this.updateFile(fileId, {
      downloadCount: file.downloadCount + 1,
    });
  }

  // ============== FILE QUERIES ==============

  async listFiles(projectId: UUID, filter?: FileFilter): Promise<WorkspaceFile[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FILE_STORE_NAME, "readonly");
      const store = transaction.objectStore(FILE_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        let files = request.result as WorkspaceFile[];

        // Apply filters
        if (filter) {
          if (!filter.isFavorite) {
            files = files.filter(f => !f.isDeleted);
          }

          if (filter.extension?.length) {
            files = files.filter(f => filter.extension!.includes(f.extension));
          }

          if (filter.folderId !== undefined) {
            files = files.filter(f => f.folderId === filter.folderId);
          }

          if (filter.tags?.length) {
            files = files.filter(f => f.tags.some(t => filter.tags!.includes(t)));
          }

          if (filter.isFavorite !== undefined) {
            files = files.filter(f => f.isFavorite === filter.isFavorite);
          }

          if (filter.search) {
            const search = filter.search.toLowerCase();
            files = files.filter(f =>
              f.name.toLowerCase().includes(search) ||
              f.tags.some(t => t.toLowerCase().includes(search))
            );
          }

          // Sort
          const sortField = filter.sortBy || "updatedAt";
          const sortOrder = filter.sortOrder || "desc";

          files.sort((a, b) => {
            let aVal: string | number = 0;
            let bVal: string | number = 0;

            switch (sortField) {
              case "name":
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
              case "size":
                aVal = a.size;
                bVal = b.size;
                break;
              case "createdAt":
                aVal = a.createdAt;
                bVal = b.createdAt;
                break;
              case "updatedAt":
                aVal = a.updatedAt;
                bVal = b.updatedAt;
                break;
              case "lastOpenedAt":
                aVal = a.lastOpenedAt || 0;
                bVal = b.lastOpenedAt || 0;
                break;
            }

            if (sortOrder === "asc") {
              return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
              return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
          });
        }

        resolve(files);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getRecentFiles(projectId: UUID, limit = 10): Promise<WorkspaceFile[]> {
    const files = await this.listFiles(projectId, {
      sortBy: "lastOpenedAt",
      sortOrder: "desc",
    });

    return files.filter(f => f.lastOpenedAt).slice(0, limit);
  }

  async getFavoriteFiles(projectId: UUID): Promise<WorkspaceFile[]> {
    return this.listFiles(projectId, { isFavorite: true });
  }

  async getPinnedFiles(projectId: UUID): Promise<WorkspaceFile[]> {
    const files = await this.listFiles(projectId);
    return files.filter(f => f.isPinned);
  }

  async searchFiles(projectId: UUID, query: string): Promise<WorkspaceFile[]> {
    return this.listFiles(projectId, { search: query });
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

  async updateFolder(folderId: UUID, updates: Partial<Folder>): Promise<Folder | null> {
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

  // ============== PREVIEW OPERATIONS ==============

  async getPreview(fileId: UUID): Promise<FilePreview> {
    const file = await this.getFile(fileId);
    if (!file) {
      return {
        fileId,
        type: "unsupported",
        content: null,
        thumbnail: null,
        language: null,
        lineCount: 0,
        isLarge: false,
        error: "File not found",
      };
    }

    const data = await this.getFileData(fileId);
    if (!data) {
      return {
        fileId,
        type: "unsupported",
        content: null,
        thumbnail: null,
        language: null,
        lineCount: 0,
        isLarge: false,
        error: "File data not found",
      };
    }

    const previewType = getPreviewType(file);

    switch (previewType) {
      case "image":
        return this.generateImagePreview(file, data);
      case "pdf":
        return this.generatePdfPreview(file, data);
      case "markdown":
      case "text":
      case "code":
      case "json":
      case "csv":
      case "html":
        return this.generateTextPreview(file, data, previewType);
      default:
        return {
          fileId,
          type: "unsupported",
          content: null,
          thumbnail: null,
          language: null,
          lineCount: 0,
          isLarge: file.size > MAX_PREVIEW_TEXT_SIZE,
          error: null,
        };
    }
  }

  private generateImagePreview(file: WorkspaceFile, data: ArrayBuffer): FilePreview {
    const blob = new Blob([data], { type: file.mimeType });
    const url = URL.createObjectURL(blob);

    return {
      fileId: file.id,
      type: "image",
      content: url,
      thumbnail: file.thumbnailUrl || url,
      language: null,
      lineCount: 0,
      isLarge: false,
      error: null,
    };
  }

  private generatePdfPreview(file: WorkspaceFile, _data: ArrayBuffer): FilePreview {
    // For PDF preview, we'd need a PDF.js library
    // For now, return a placeholder
    return {
      fileId: file.id,
      type: "pdf",
      content: null, // Would be PDF.js viewer URL
      thumbnail: file.thumbnailUrl || null,
      language: null,
      lineCount: 0,
      isLarge: file.size > MAX_PREVIEW_TEXT_SIZE,
      error: null,
    };
  }

  private generateTextPreview(file: WorkspaceFile, data: ArrayBuffer, type: PreviewType): FilePreview {
    const decoder = new TextDecoder("utf-8");
    let content = decoder.decode(data);

    const isLarge = content.length > MAX_PREVIEW_TEXT_SIZE;
    if (isLarge) {
      content = content.slice(0, MAX_PREVIEW_TEXT_SIZE) + "\n... (truncated)";
    }

    const lines = content.split("\n");
    const previewText = lines.slice(0, 100).join("\n");

    return {
      fileId: file.id,
      type,
      content: previewText,
      thumbnail: null,
      language: file.extension,
      lineCount: lines.length,
      isLarge,
      error: null,
    };
  }

  // ============== STORAGE OPERATIONS ==============

  async getStorageUsage(projectId: UUID): Promise<StorageUsage> {
    const files = await this.listFiles(projectId);

    const filesSize = files.reduce((sum, f) => sum + f.size, 0);

    return {
      id: crypto.randomUUID(),
      projectId,
      filesSize,
      notesSize: 0,
      clipboardSize: 0,
      otherSize: 0,
      totalSize: filesSize,
      fileCount: files.filter(f => !f.isDeleted).length,
      noteCount: 0,
      taskCount: 0,
      snippetCount: 0,
      clipboardCount: 0,
      calculatedAt: Date.now(),
    };
  }

  async clearProjectFiles(projectId: UUID): Promise<void> {
    const files = await this.listFiles(projectId, { includeDeleted: true });

    for (const file of files) {
      await this.deleteFile(file.id, true);
    }

    const folders = await this.listFolders(projectId);
    for (const folder of folders) {
      await this.deleteFolder(folder.id, true);
    }

    this.emit("project:cleared", { projectId });
  }

  // ============== EXPORT OPERATIONS ==============

  async downloadFile(fileId: UUID): Promise<void> {
    const file = await this.getFile(fileId);
    if (!file) throw new Error("File not found");

    const data = await this.getFileData(fileId);
    if (!data) throw new Error("File data not found");

    const blob = new Blob([data], { type: file.mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await this.incrementDownloadCount(fileId);
    this.emit("file:downloaded", { file });
  }

  // ============== PRIVATE HELPERS ==============

  private async storeFileData(
    fileId: UUID,
    data: ArrayBuffer,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FILE_DATA_STORE_NAME, "readwrite");
      const store = transaction.objectStore(FILE_DATA_STORE_NAME);

      const request = store.put({
        fileId,
        data,
        storedAt: Date.now(),
      });

      if (onProgress) {
        onProgress(100);
      }

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveFile(file: WorkspaceFile): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FILE_STORE_NAME, "readwrite");
      const store = transaction.objectStore(FILE_STORE_NAME);
      const request = store.put(file);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFileRecord(fileId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FILE_STORE_NAME, "readwrite");
      const store = transaction.objectStore(FILE_STORE_NAME);
      const request = store.delete(fileId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFileData(fileId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FILE_DATA_STORE_NAME, "readwrite");
      const store = transaction.objectStore(FILE_DATA_STORE_NAME);
      const request = store.delete(fileId);

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

  private async deleteFolderRecord(folderId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(FOLDER_STORE_NAME, "readwrite");
      const store = transaction.objectStore(FOLDER_STORE_NAME);
      const request = store.delete(folderId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async generatePreview(file: WorkspaceFile, data: ArrayBuffer): Promise<void> {
    const previewType = getPreviewType(file);

    // Generate thumbnail for images
    if (previewType === "image" && isImageFile(file.extension)) {
      const thumbnail = await this.generateThumbnail(data, file.mimeType);
      if (thumbnail) {
        await this.updateFile(file.id, { thumbnailUrl: thumbnail });
      }
    }

    // Generate preview text for text-based files
    if (["markdown", "text", "code", "json", "csv", "html"].includes(previewType)) {
      const decoder = new TextDecoder("utf-8");
      const content = decoder.decode(data);
      const previewText = content.slice(0, MAX_PREVIEW_TEXT_SIZE);

      await this.updateFile(file.id, { previewText });
    }
  }

  private async generateThumbnail(data: ArrayBuffer, mimeType: string): Promise<string | null> {
    return new Promise((resolve) => {
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = this.config.thumbnailSize;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > size) {
            height = (height * size) / width;
            width = size;
          }
        } else {
          if (height > size) {
            width = (width * size) / height;
            height = size;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const thumbnail = canvas.toDataURL(mimeType, 0.7);
        URL.revokeObjectURL(url);

        resolve(thumbnail);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  }
}
