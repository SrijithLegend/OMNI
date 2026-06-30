/**
 * Workspace Engine — The heart of Omni.
 *
 * Manages the user's workspace, projects, recent activity, search index,
 * pinned items, notifications, and connectors.
 */

import { BaseEngine, registerEngine, getEngine } from "./base";
import type { Workspace, WorkspaceActivity } from "../models/workspace";
import { createWorkspace } from "../models/workspace";
import type { StorageEngine } from "./storage";
import { STORAGE_KEYS_REF } from "./storage";
import type { MessagingEngine } from "../messaging/engine";

export class WorkspaceEngine extends BaseEngine {
  private workspace: Workspace | null = null;
  private storage: StorageEngine | null = null;
  private messaging: MessagingEngine | null = null;

  constructor() {
    super({ name: "WorkspaceEngine", version: "1.0.0", debug: false });
    this.dependsOn("StorageEngine");
    this.dependsOn("MessagingEngine");
  }

  async start(): Promise<void> {
    this.storage = getEngine<StorageEngine>("StorageEngine");
    this.messaging = getEngine<MessagingEngine>("MessagingEngine");

    if (!this.storage) throw new Error("StorageEngine not available");

    // Load or create workspace
    const existing = await this.storage.get<Workspace>(STORAGE_KEYS_REF.WORKSPACE);
    if (existing) {
      this.workspace = existing;
      this.log("info", "Workspace loaded", existing.name);
    } else {
      const settings = await this.storage.get<{ id: string }>(STORAGE_KEYS_REF.SETTINGS);
      this.workspace = createWorkspace("My Workspace", settings?.id ?? crypto.randomUUID());
      await this.storage.set(STORAGE_KEYS_REF.WORKSPACE, this.workspace);
      this.log("info", "Workspace created");
    }

    this.isRunning = true;
    this.emit("ready", this.workspace);
  }

  async stop(): Promise<void> {
    if (this.workspace && this.storage) {
      await this.storage.set(STORAGE_KEYS_REF.WORKSPACE, this.workspace);
    }
    this.isRunning = false;
    this.log("info", "Workspace engine stopped");
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: !!this.workspace,
      message: this.workspace ? `Workspace: ${this.workspace.name}` : "No workspace",
      timestamp: Date.now(),
    };
  }

  getWorkspace(): Workspace | null {
    return this.workspace;
  }

  async saveWorkspace(): Promise<void> {
    if (!this.workspace || !this.storage) return;
    this.workspace.updatedAt = Date.now();
    await this.storage.set(STORAGE_KEYS_REF.WORKSPACE, this.workspace);
    this.emit("saved", this.workspace);
  }

  async addProject(projectId: string): Promise<void> {
    if (!this.workspace) return;
    this.workspace.projects.push(projectId);
    this.workspace.stats.totalProjects += 1;
    await this.saveWorkspace();
    this.emit("project-added", projectId);
  }

  async setActiveProject(projectId: string | null): Promise<void> {
    if (!this.workspace) return;
    this.workspace.activeProjectId = projectId;
    if (projectId) {
      this.workspace.recentProjectIds = [
        projectId,
        ...this.workspace.recentProjectIds.filter((id) => id !== projectId),
      ].slice(0, 5);
    }
    await this.saveWorkspace();
    this.emit("active-project-changed", projectId);
  }

  async addActivity(activity: WorkspaceActivity): Promise<void> {
    if (!this.workspace) return;
    this.workspace.recentActivity.unshift(activity);
    if (this.workspace.recentActivity.length > 100) {
      this.workspace.recentActivity = this.workspace.recentActivity.slice(0, 100);
    }
    this.workspace.stats.lastActivityAt = Date.now();
    await this.saveWorkspace();
    this.emit("activity", activity);
  }

  async addNotification(notification: Workspace["notifications"][0]): Promise<void> {
    if (!this.workspace) return;
    this.workspace.notifications.unshift(notification);
    this.workspace.unreadCount += 1;
    await this.saveWorkspace();
    this.emit("notification", notification);
  }

  async markNotificationsRead(): Promise<void> {
    if (!this.workspace) return;
    this.workspace.notifications.forEach((n) => (n.read = true));
    this.workspace.unreadCount = 0;
    await this.saveWorkspace();
    this.emit("notifications-read");
  }

  async updateStats(updates: Partial<Workspace["stats"]>): Promise<void> {
    if (!this.workspace) return;
    Object.assign(this.workspace.stats, updates);
    this.workspace.stats.lastActivityAt = Date.now();
    await this.saveWorkspace();
  }
}
