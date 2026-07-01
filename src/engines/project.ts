/**
 * ProjectEngine — Business logic for Project CRUD, search, stats and templates.
 *
 * Persists through the StorageEngine (chrome.storage.local). No direct storage
 * access is performed by callers; everything routes through this engine.
 */

import {
  Project,
  ProjectId,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectSearchQuery,
  ProjectStats,
  ProjectTemplate,
  ProjectTemplateConfig,
} from "@/types";
import { StorageEngine } from "@/storage";

// ============== TEMPLATES ==============

const TEMPLATES: ProjectTemplateConfig[] = [
  {
    id: "software",
    name: "Software",
    description: "Code, docs, and tasks for a dev project",
    icon: "Code",
    color: "#3b82f6",
    defaultTags: ["development", "engineering"],
    defaultMetadata: { language: null, framework: null },
  },
  {
    id: "research",
    name: "Research",
    description: "Papers, notes, and references",
    icon: "FlaskConical",
    color: "#8b5cf6",
    defaultTags: ["research", "notes"],
    defaultMetadata: {},
  },
  {
    id: "startup",
    name: "Startup",
    description: "Plans, pitches, and product work",
    icon: "Rocket",
    color: "#f97316",
    defaultTags: ["startup", "product"],
    defaultMetadata: {},
  },
  {
    id: "college",
    name: "College",
    description: "Courses, assignments, and study notes",
    icon: "GraduationCap",
    color: "#10b981",
    defaultTags: ["study", "college"],
    defaultMetadata: {},
  },
  {
    id: "personal",
    name: "Personal",
    description: "Personal goals, ideas, and journaling",
    icon: "User",
    color: "#ec4899",
    defaultTags: ["personal"],
    defaultMetadata: {},
  },
  {
    id: "blank",
    name: "Blank",
    description: "Start from scratch",
    icon: "FileText",
    color: "#64748b",
    defaultTags: [],
    defaultMetadata: {},
  },
];

// ============== HELPERS ==============

function emptyStats(): ProjectStats {
  return {
    conversationCount: 0,
    fileCount: 0,
    noteCount: 0,
    taskCount: 0,
    totalTokens: 0,
    totalTime: 0,
    activityScore: 0,
  };
}

function matchesFilter(project: Project, query: ProjectSearchQuery): boolean {
  if (project.isDeleted && !query.includeDeleted) return false;
  if (project.isArchived && !query.includeArchived && query.filter !== "archived") {
    return false;
  }

  switch (query.filter) {
    case "favorites":
      if (!project.isFavorite) return false;
      break;
    case "pinned":
      if (!project.isPinned) return false;
      break;
    case "archived":
      if (!project.isArchived) return false;
      break;
    case "recent":
      if (project.lastOpenedAt === null) return false;
      break;
    case "all":
    default:
      break;
  }

  if (query.text.trim()) {
    const text = query.text.trim().toLowerCase();
    const haystack = [
      project.name,
      project.description,
      ...project.tags,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(text)) return false;
  }

  return true;
}

function sortProjects(projects: Project[], sort: ProjectSearchQuery["sort"]): Project[] {
  const sorted = [...projects];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case "recently-opened":
      return sorted.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
    case "alphabetical":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "most-active":
      return sorted.sort((a, b) => b.stats.activityScore - a.stats.activityScore);
    case "newest":
    default:
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
  }
}

// ============== ENGINE ==============

export const ProjectEngine = {
  getTemplates(): ProjectTemplateConfig[] {
    return TEMPLATES;
  },

  getTemplate(id: ProjectTemplate): ProjectTemplateConfig | null {
    return TEMPLATES.find((t) => t.id === id) ?? null;
  },

  async list(): Promise<Project[]> {
    return StorageEngine.getAllProjects();
  },

  async get(id: ProjectId): Promise<Project | null> {
    return StorageEngine.getProjectById(id);
  },

  search(projects: Project[], query: ProjectSearchQuery): Project[] {
    const filtered = projects.filter((p) => matchesFilter(p, query));
    return sortProjects(filtered, query.sort);
  },

  getStats(projects: Project[]): {
    total: number;
    active: number;
    archived: number;
    favorites: number;
    pinned: number;
    totalConversations: number;
    totalFiles: number;
    totalNotes: number;
    totalTasks: number;
  } {
    const active = projects.filter((p) => !p.isDeleted && !p.isArchived);
    return {
      total: projects.filter((p) => !p.isDeleted).length,
      active: active.length,
      archived: projects.filter((p) => p.isArchived && !p.isDeleted).length,
      favorites: projects.filter((p) => p.isFavorite && !p.isDeleted).length,
      pinned: projects.filter((p) => p.isPinned && !p.isDeleted).length,
      totalConversations: projects.reduce((s, p) => s + p.stats.conversationCount, 0),
      totalFiles: projects.reduce((s, p) => s + p.stats.fileCount, 0),
      totalNotes: projects.reduce((s, p) => s + p.stats.noteCount, 0),
      totalTasks: projects.reduce((s, p) => s + p.stats.taskCount, 0),
    };
  },

  async create(input: ProjectCreateInput): Promise<Project> {
    const name = input.name.trim();
    if (!name) throw new Error("Project name is required");
    if (name.length > 100) throw new Error("Name must be under 100 characters");

    const existing = await StorageEngine.getAllProjects();
    const duplicate = existing.find(
      (p) => !p.isDeleted && p.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) throw new Error("A project with this name already exists");

    const template = input.template ? this.getTemplate(input.template) : null;
    const now = Date.now();

    const project: Project = {
      id: crypto.randomUUID(),
      name,
      description: input.description?.trim() ?? "",
      icon: input.icon ?? template?.icon ?? "FileText",
      color: input.color ?? template?.color ?? "#3b82f6",
      tags: input.tags ?? template?.defaultTags ?? [],
      template: input.template ?? null,
      isFavorite: false,
      isArchived: false,
      isPinned: false,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
      stats: emptyStats(),
      metadata: {
        url: null,
        language: template?.defaultMetadata.language ?? null,
        framework: template?.defaultMetadata.framework ?? null,
        version: null,
        custom: {},
      },
      future: {
        aiMemory: [],
        connectorIds: [],
        conversationIds: [],
        noteIds: [],
        taskIds: [],
        timelineIds: [],
        fileIds: [],
      },
    };

    await StorageEngine.saveProject(project);
    return project;
  },

  async update(id: ProjectId, input: ProjectUpdateInput): Promise<Project> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) throw new Error("Project not found");

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error("Project name is required");
      if (name.length > 100) throw new Error("Name must be under 100 characters");
    }

    const updated: Project = {
      ...project,
      ...input,
      name: input.name?.trim() ?? project.name,
      description: input.description?.trim() ?? project.description,
      updatedAt: Date.now(),
    };

    await StorageEngine.saveProject(updated);
    return updated;
  },

  /** Patch project.stats — used by the workspace store to keep counts in sync. */
  async updateStats(id: ProjectId, patch: Partial<ProjectStats>): Promise<void> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) return;
    await StorageEngine.saveProject({
      ...project,
      stats: { ...project.stats, ...patch },
      updatedAt: Date.now(),
    });
  },

  async softDelete(id: ProjectId): Promise<void> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) return;
    await StorageEngine.saveProject({
      ...project,
      isDeleted: true,
      deletedAt: Date.now(),
      isPinned: false,
      isFavorite: false,
      updatedAt: Date.now(),
    });
  },

  async restore(id: ProjectId): Promise<void> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) return;
    await StorageEngine.saveProject({
      ...project,
      isDeleted: false,
      deletedAt: null,
      updatedAt: Date.now(),
    });
  },

  async permanentDelete(id: ProjectId): Promise<void> {
    await StorageEngine.deleteProject(id);
  },

  async toggleFavorite(id: ProjectId): Promise<void> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) return;
    await StorageEngine.saveProject({
      ...project,
      isFavorite: !project.isFavorite,
      updatedAt: Date.now(),
    });
  },

  async togglePin(id: ProjectId): Promise<void> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) return;
    await StorageEngine.saveProject({
      ...project,
      isPinned: !project.isPinned,
      updatedAt: Date.now(),
    });
  },

  async toggleArchive(id: ProjectId): Promise<void> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) return;
    await StorageEngine.saveProject({
      ...project,
      isArchived: !project.isArchived,
      updatedAt: Date.now(),
    });
  },

  async open(id: ProjectId): Promise<Project> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) throw new Error("Project not found");
    const updated: Project = { ...project, lastOpenedAt: Date.now() };
    await StorageEngine.saveProject(updated);
    return updated;
  },
};
