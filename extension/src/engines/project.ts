/**
 * Project Engine — Manages all project lifecycle operations.
 *
 * Create, update, archive, delete, and manage project metadata.
 */

import { BaseEngine, registerEngine, getEngine } from "./base";
import type { Project, ProjectStats } from "../models/project";
import { createProject } from "../models/project";
import type { StorageEngine } from "./storage";
import { STORAGE_KEYS_REF } from "./storage";

export class ProjectEngine extends BaseEngine {
  private projects: Map<string, Project> = new Map();
  private storage: StorageEngine | null = null;

  constructor() {
    super({ name: "ProjectEngine", version: "1.0.0", debug: false });
    this.dependsOn("StorageEngine");
    this.dependsOn("WorkspaceEngine");
  }

  async start(): Promise<void> {
    this.storage = getEngine<StorageEngine>("StorageEngine");
    if (!this.storage) throw new Error("StorageEngine not available");

    const data = await this.storage.get<Record<string, Project>>(STORAGE_KEYS_REF.PROJECTS);
    if (data) {
      for (const [id, project] of Object.entries(data)) {
        this.projects.set(id, project);
      }
    }
    this.isRunning = true;
    this.emit("ready", { count: this.projects.size });
  }

  async stop(): Promise<void> {
    await this.saveAll();
    this.projects.clear();
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: true,
      message: `Projects: ${this.projects.size} loaded`,
      timestamp: Date.now(),
    };
  }

  async create(name: string, color?: string, icon?: string): Promise<Project> {
    const project = createProject(name, color, icon);
    this.projects.set(project.id, project);
    await this.saveAll();
    this.emit("created", project);
    return project;
  }

  get(id: string): Project | null {
    return this.projects.get(id) ?? null;
  }

  getAll(): Project[] {
    return Array.from(this.projects.values());
  }

  getActive(): Project[] {
    return this.getAll().filter((p) => p.status === "active");
  }

  getArchived(): Project[] {
    return this.getAll().filter((p) => p.status === "archived");
  }

  getFavourites(): Project[] {
    return this.getAll().filter((p) => p.status === "favourite");
  }

  async update(id: string, updates: Partial<Project>): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project) return null;
    Object.assign(project, updates);
    project.updatedAt = Date.now();
    await this.saveAll();
    this.emit("updated", project);
    return project;
  }

  async archive(id: string): Promise<Project | null> {
    return this.update(id, { status: "archived" });
  }

  async restore(id: string): Promise<Project | null> {
    return this.update(id, { status: "active" });
  }

  async favourite(id: string): Promise<Project | null> {
    return this.update(id, { status: "favourite" });
  }

  async delete(id: string): Promise<boolean> {
    const removed = this.projects.delete(id);
    if (removed) {
      await this.saveAll();
      this.emit("deleted", id);
    }
    return removed;
  }

  async addConversation(projectId: string, conversationId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) return;
    project.conversations.push(conversationId);
    project.stats.totalConversations += 1;
    project.updatedAt = Date.now();
    await this.saveAll();
  }

  async updateStats(projectId: string, updates: Partial<ProjectStats>): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) return;
    Object.assign(project.stats, updates);
    project.updatedAt = Date.now();
    await this.saveAll();
  }

  private async saveAll(): Promise<void> {
    if (!this.storage) return;
    const data: Record<string, Project> = {};
    for (const [id, project] of this.projects) {
      data[id] = project;
    }
    await this.storage.set(STORAGE_KEYS_REF.PROJECTS, data);
  }
}
