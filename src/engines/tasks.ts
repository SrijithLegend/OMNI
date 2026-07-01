/**
 * Tasks Engine — Manages tasks with Kanban and List view support.
 *
 * Responsibilities:
 * - CRUD operations for tasks
 * - Status and priority management
 * - Progress tracking
 * - Kanban board ordering
 * - Task dependencies (future)
 * - Statistics and analytics
 */

import { BaseEngine, type HealthStatus } from "./base";
import type { UUID } from "../types/omni";
import type { Task, TaskStatus, TaskPriority, TaskFilter, TaskStats, Folder } from "../models/workspace";
import { createEmptyTask, createFolder, getTaskStats } from "../models/workspace";

// ============== CONSTANTS ==============

const TASK_STORE_NAME = "omni_tasks";
const FOLDER_STORE_NAME = "omni_task_folders";

// ============== INTERFACES ==============

export interface TasksConfig {
  defaultStatus: TaskStatus;
  defaultPriority: TaskPriority;
  autoArchiveCompleted: boolean;
  autoArchiveAfterDays: number;
}

export interface TaskUpdateData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  folderId?: UUID | null;
  tags?: string[];
  progress?: number;
  dueDate?: string | null;
  startedAt?: number | null;
  completedAt?: number | null;
  position?: number;
  isFavorite?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
  deletedAt?: number | null;
}

export interface KanbanColumn {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  color: string;
}

// ============== TASKS ENGINE ==============

export class TasksEngine extends BaseEngine {
  private db: IDBDatabase | null = null;
  private config: TasksConfig;

  constructor(config?: Partial<TasksConfig>) {
    super({ name: "TasksEngine", version: "1.0.0", debug: false });
    this.config = {
      defaultStatus: config?.defaultStatus || "todo",
      defaultPriority: config?.defaultPriority || "medium",
      autoArchiveCompleted: config?.autoArchiveCompleted ?? false,
      autoArchiveAfterDays: config?.autoArchiveAfterDays || 7,
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
      message: this.db ? "Tasks Engine ready" : "Database not initialized",
      timestamp: Date.now(),
    };
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("OmniTasks", 1);

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

        // Tasks store
        if (!db.objectStoreNames.contains(TASK_STORE_NAME)) {
          const taskStore = db.createObjectStore(TASK_STORE_NAME, { keyPath: "id" });
          taskStore.createIndex("projectId", "projectId", { unique: false });
          taskStore.createIndex("folderId", "folderId", { unique: false });
          taskStore.createIndex("status", "status", { unique: false });
          taskStore.createIndex("priority", "priority", { unique: false });
          taskStore.createIndex("isDeleted", "isDeleted", { unique: false });
          taskStore.createIndex("isFavorite", "isFavorite", { unique: false });
          taskStore.createIndex("isPinned", "isPinned", { unique: false });
          taskStore.createIndex("dueDate", "dueDate", { unique: false });
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

  // ============== TASK OPERATIONS ==============

  async createTask(projectId: UUID, title: string, description = ""): Promise<Task> {
    // Get max position for ordering
    const tasks = await this.listTasks(projectId, { status: ["todo"] });
    const maxPosition = tasks.reduce((max, t) => Math.max(max, t.position), -1);

    const task = createEmptyTask(projectId, title);
    task.description = description;
    task.status = this.config.defaultStatus;
    task.priority = this.config.defaultPriority;
    task.position = maxPosition + 1;

    await this.saveTask(task);
    this.emit("task:created", { task });

    return task;
  }

  async getTask(taskId: UUID): Promise<Task | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(TASK_STORE_NAME, "readonly");
      const store = transaction.objectStore(TASK_STORE_NAME);
      const request = store.get(taskId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTask(taskId: UUID, data: TaskUpdateData): Promise<Task | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    const updatedTask: Task = {
      ...task,
      ...data,
      updatedAt: Date.now(),
    };

    // Auto-set dates based on status
    if (data.status === "in_progress" && !task.startedAt) {
      updatedTask.startedAt = Date.now();
    }

    if (data.status === "done" && !task.completedAt) {
      updatedTask.completedAt = Date.now();
      updatedTask.progress = 100;
    }

    // Reset completedAt if moving away from done
    if (data.status && data.status !== "done" && task.status === "done") {
      updatedTask.completedAt = null;
      if (data.progress === undefined) {
        updatedTask.progress = 0;
      }
    }

    await this.saveTask(updatedTask);

    // Emit appropriate event
    if (data.status && data.status !== task.status) {
      this.emit("task:statusChanged", {
        task: updatedTask,
        oldStatus: task.status,
        newStatus: data.status,
      });
    } else {
      this.emit("task:updated", { task: updatedTask });
    }

    return updatedTask;
  }

  async deleteTask(taskId: UUID, permanent = false): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task) return false;

    if (permanent) {
      await this.deleteTaskRecord(taskId);
      this.emit("task:deleted", { taskId, permanent: true });
    } else {
      await this.updateTask(taskId, { isDeleted: true });
      this.emit("task:deleted", { taskId, permanent: false });
    }

    return true;
  }

  async restoreTask(taskId: UUID): Promise<Task | null> {
    return this.updateTask(taskId, { isDeleted: false });
  }

  async completeTask(taskId: UUID): Promise<Task | null> {
    this.emit("task:completed", { taskId });
    return this.updateTask(taskId, {
      status: "done",
      completedAt: Date.now(),
      progress: 100,
    });
  }

  async uncompleteTask(taskId: UUID): Promise<Task | null> {
    return this.updateTask(taskId, {
      status: "todo",
      completedAt: null,
      progress: 0,
    });
  }

  async archiveTask(taskId: UUID): Promise<Task | null> {
    this.emit("task:archived", { taskId });
    return this.updateTask(taskId, { status: "archived" });
  }

  async unarchiveTask(taskId: UUID): Promise<Task | null> {
    return this.updateTask(taskId, { status: "todo" });
  }

  async toggleFavorite(taskId: UUID): Promise<Task | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    return this.updateTask(taskId, { isFavorite: !task.isFavorite });
  }

  async togglePinned(taskId: UUID): Promise<Task | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    return this.updateTask(taskId, { isPinned: !task.isPinned });
  }

  // ============== TASK QUERIES ==============

  async listTasks(projectId: UUID, filter?: TaskFilter): Promise<Task[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(TASK_STORE_NAME, "readonly");
      const store = transaction.objectStore(TASK_STORE_NAME);
      const index = store.index("projectId");
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        let tasks = request.result as Task[];

        // Apply filters
        if (filter) {
          // Exclude deleted by default
          if (filter.isDeleted === undefined) {
            tasks = tasks.filter(t => !t.isDeleted);
          }

          if (filter.status?.length) {
            tasks = tasks.filter(t => filter.status!.includes(t.status));
          }

          if (filter.priority?.length) {
            tasks = tasks.filter(t => filter.priority!.includes(t.priority));
          }

          if (filter.folderId !== undefined) {
            tasks = tasks.filter(t => t.folderId === filter.folderId);
          }

          if (filter.tags?.length) {
            tasks = tasks.filter(t => t.tags.some(tag => filter.tags!.includes(tag)));
          }

          if (filter.isFavorite !== undefined) {
            tasks = tasks.filter(t => t.isFavorite === filter.isFavorite);
          }

          if (filter.dueBefore) {
            tasks = tasks.filter(t => t.dueDate && t.dueDate < filter.dueBefore!);
          }

          if (filter.dueAfter) {
            tasks = tasks.filter(t => t.dueDate && t.dueDate > filter.dueAfter!);
          }

          if (filter.search) {
            const search = filter.search.toLowerCase();
            tasks = tasks.filter(t =>
              t.title.toLowerCase().includes(search) ||
              t.description.toLowerCase().includes(search) ||
              t.tags.some(tag => tag.toLowerCase().includes(search))
            );
          }

          // Sort
          const sortField = filter.sortBy || "position";
          const sortOrder = filter.sortOrder || "asc";

          tasks.sort((a, b) => {
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
              case "dueDate":
                aVal = a.dueDate || "zzzz";
                bVal = b.dueDate || "zzzz";
                break;
              case "priority":
                // Urgent=0, High=1, Medium=2, Low=3
                const priorityMap: Record<TaskPriority, number> = {
                  urgent: 0,
                  high: 1,
                  medium: 2,
                  low: 3,
                };
                aVal = priorityMap[a.priority];
                bVal = priorityMap[b.priority];
                break;
              case "position":
                aVal = a.position;
                bVal = b.position;
                break;
            }

            if (sortOrder === "asc") {
              return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
              return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
          });
        }

        resolve(tasks);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getKanbanBoard(projectId: UUID): Promise<KanbanColumn[]> {
    const tasks = await this.listTasks(projectId);

    const statuses: TaskStatus[] = ["todo", "in_progress", "review", "done"];

    const columns: KanbanColumn[] = statuses.map(status => ({
      status,
      title: this.getStatusTitle(status),
      tasks: tasks
        .filter(t => t.status === status)
        .sort((a, b) => a.position - b.position),
      color: this.getStatusColor(status),
    }));

    return columns;
  }

  async getTaskById(taskId: UUID): Promise<Task | null> {
    return this.getTask(taskId);
  }

  async getTasksByStatus(projectId: UUID, status: TaskStatus): Promise<Task[]> {
    return this.listTasks(projectId, { status: [status] });
  }

  async getTasksByPriority(projectId: UUID, priority: TaskPriority): Promise<Task[]> {
    return this.listTasks(projectId, { priority: [priority] });
  }

  async getOverdueTasks(projectId: UUID): Promise<Task[]> {
    const today = new Date().toISOString().split("T")[0];
    const tasks = await this.listTasks(projectId);
    return tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== "done");
  }

  async getDueTodayTasks(projectId: UUID): Promise<Task[]> {
    const today = new Date().toISOString().split("T")[0];
    const tasks = await this.listTasks(projectId);
    return tasks.filter(t => t.dueDate === today);
  }

  async getDueThisWeekTasks(projectId: UUID): Promise<Task[]> {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const tasks = await this.listTasks(projectId);
    return tasks.filter(t =>
      t.dueDate &&
      t.dueDate >= today &&
      t.dueDate <= weekFromNow &&
      t.status !== "done"
    );
  }

  async getFavoriteTasks(projectId: UUID): Promise<Task[]> {
    return this.listTasks(projectId, { isFavorite: true });
  }

  async getPinnedTasks(projectId: UUID): Promise<Task[]> {
    const tasks = await this.listTasks(projectId);
    return tasks.filter(t => t.isPinned);
  }

  async searchTasks(projectId: UUID, query: string): Promise<Task[]> {
    return this.listTasks(projectId, { search: query });
  }

  // ============== TASK ORDERING ==============

  async reorderTask(taskId: UUID, newStatus: TaskStatus, newPosition: number): Promise<Task | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    // Get all tasks in the target column
    const tasks = await this.getTasksByStatus(task.projectId, newStatus);

    // Remove task from its current position if it's in the same column
    const filteredTasks = tasks.filter(t => t.id !== taskId);

    // Insert at new position
    filteredTasks.splice(newPosition, 0, task);

    // Update positions
    for (let i = 0; i < filteredTasks.length; i++) {
      await this.updateTask(filteredTasks[i].id, { position: i, status: newStatus });
    }

    return this.getTask(taskId);
  }

  async moveTaskToStatus(taskId: UUID, status: TaskStatus): Promise<Task | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;

    const tasks = await this.getTasksByStatus(task.projectId, status);
    const maxPosition = tasks.reduce((max, t) => Math.max(max, t.position), -1);

    return this.updateTask(taskId, { status, position: maxPosition + 1 });
  }

  // ============== STATISTICS ==============

  async getStats(projectId: UUID): Promise<TaskStats> {
    const tasks = await this.listTasks(projectId);
    return getTaskStats(tasks);
  }

  async getProgress(projectId: UUID): Promise<number> {
    const stats = await this.getStats(projectId);
    if (stats.total === 0) return 0;
    return Math.round((stats.done / stats.total) * 100);
  }

  // ============== BULK OPERATIONS ==============

  async bulkUpdateStatus(taskIds: UUID[], status: TaskStatus): Promise<void> {
    for (const taskId of taskIds) {
      await this.updateTask(taskId, { status });
    }
    this.emit("tasks:bulkUpdated", { taskIds, action: "status", status });
  }

  async bulkUpdatePriority(taskIds: UUID[], priority: TaskPriority): Promise<void> {
    for (const taskId of taskIds) {
      await this.updateTask(taskId, { priority });
    }
    this.emit("tasks:bulkUpdated", { taskIds, action: "priority", priority });
  }

  async bulkDelete(taskIds: UUID[], permanent = false): Promise<void> {
    for (const taskId of taskIds) {
      await this.deleteTask(taskId, permanent);
    }
    this.emit("tasks:bulkDeleted", { taskIds, permanent });
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

  // ============== PRIVATE HELPERS ==============

  private getStatusTitle(status: TaskStatus): string {
    const titles: Record<TaskStatus, string> = {
      todo: "To Do",
      in_progress: "In Progress",
      review: "Review",
      done: "Done",
      archived: "Archived",
    };
    return titles[status];
  }

  private getStatusColor(status: TaskStatus): string {
    const colors: Record<TaskStatus, string> = {
      todo: "gray",
      in_progress: "blue",
      review: "yellow",
      done: "green",
      archived: "slate",
    };
    return colors[status];
  }

  private async saveTask(task: Task): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(TASK_STORE_NAME, "readwrite");
      const store = transaction.objectStore(TASK_STORE_NAME);
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteTaskRecord(taskId: UUID): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction(TASK_STORE_NAME, "readwrite");
      const store = transaction.objectStore(TASK_STORE_NAME);
      const request = store.delete(taskId);

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
