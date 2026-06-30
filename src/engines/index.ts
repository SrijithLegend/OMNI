import { Project, ProjectId, ProjectCreateInput, ProjectUpdateInput, ProjectSearchQuery, ProjectTemplate, ProjectTemplateConfig, PROJECT_COLORS, PROJECT_ICONS } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { StorageEngine } from '@/storage';

const TEMPLATES: Record<ProjectTemplate, ProjectTemplateConfig> = {
  software: { id: 'software', name: 'Software Project', description: 'A project for building software, apps, or tools', icon: 'Code', color: '#3b82f6', defaultTags: ['dev', 'coding', 'software'], defaultMetadata: { framework: null, language: null } },
  research: { id: 'research', name: 'Research', description: 'For research, studies, and academic work', icon: 'FlaskConical', color: '#10b981', defaultTags: ['research', 'study', 'academic'], defaultMetadata: {} },
  startup: { id: 'startup', name: 'Startup', description: 'Launching a product or business', icon: 'Rocket', color: '#f59e0b', defaultTags: ['business', 'startup', 'product'], defaultMetadata: {} },
  college: { id: 'college', name: 'College', description: 'Classes, assignments, and coursework', icon: 'GraduationCap', color: '#8b5cf6', defaultTags: ['school', 'education', 'course'], defaultMetadata: {} },
  personal: { id: 'personal', name: 'Personal', description: 'Personal projects and hobbies', icon: 'Heart', color: '#ec4899', defaultTags: ['personal', 'hobby', 'life'], defaultMetadata: {} },
  blank: { id: 'blank', name: 'Blank', description: 'Start from scratch', icon: 'FileText', color: '#64748b', defaultTags: [], defaultMetadata: {} },
};

function createProjectStats(): Project['stats'] {
  return { conversationCount: 0, fileCount: 0, noteCount: 0, taskCount: 0, totalTokens: 0, totalTime: 0, activityScore: 0 };
}

function createProjectFuture(): Project['future'] {
  return { aiMemory: [], connectorIds: [], conversationIds: [], noteIds: [], taskIds: [], timelineIds: [], fileIds: [] };
}

function createProjectMetadata(): Project['metadata'] {
  return { url: null, language: null, framework: null, version: null, custom: {} };
}

export const ProjectEngine = {
  getTemplates(): ProjectTemplateConfig[] {
    return Object.values(TEMPLATES);
  },

  getTemplate(id: ProjectTemplate): ProjectTemplateConfig | undefined {
    return TEMPLATES[id];
  },

  async list(): Promise<Project[]> {
    return StorageEngine.getAllProjects();
  },

  async get(id: ProjectId): Promise<Project | null> {
    return StorageEngine.getProjectById(id);
  },

  async create(input: ProjectCreateInput): Promise<Project> {
    const trimmedName = input.name.trim();
    if (!trimmedName) throw new Error('Project name is required');
    if (trimmedName.length > 100) throw new Error('Project name must be under 100 characters');
    if (trimmedName.length < 1) throw new Error('Project name is required');

    const all = await StorageEngine.getAllProjects();
    const normalized = trimmedName.toLowerCase();
    if (all.some((p) => !p.isDeleted && p.name.trim().toLowerCase() === normalized)) {
      throw new Error(`A project named "${trimmedName}" already exists`);
    }

    const template = input.template ? TEMPLATES[input.template] : null;
    const now = Date.now();

    const project: Project = {
      id: uuidv4(),
      name: trimmedName,
      description: (input.description ?? '').trim(),
      icon: input.icon ?? template?.icon ?? 'FileText',
      color: input.color ?? template?.color ?? PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
      tags: input.tags?.length ? input.tags.map((t) => t.trim()).filter(Boolean) : (template?.defaultTags ?? []),
      template: input.template ?? null,
      isFavorite: false,
      isArchived: false,
      isPinned: false,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      stats: createProjectStats(),
      metadata: { ...createProjectMetadata(), ...template?.defaultMetadata },
      future: createProjectFuture(),
    };

    await StorageEngine.saveProject(project);
    return project;
  },

  async update(id: ProjectId, input: ProjectUpdateInput): Promise<Project> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) throw new Error('Project not found');
    if (project.isDeleted) throw new Error('Cannot edit a deleted project');

    const updates: Partial<Project> = {};
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new Error('Project name cannot be empty');
      if (trimmed.length > 100) throw new Error('Project name must be under 100 characters');
      const all = await StorageEngine.getAllProjects();
      const normalized = trimmed.toLowerCase();
      if (all.some((p) => p.id !== id && !p.isDeleted && p.name.trim().toLowerCase() === normalized)) {
        throw new Error(`A project named "${trimmed}" already exists`);
      }
      updates.name = trimmed;
    }
    if (input.description !== undefined) updates.description = input.description.trim();
    if (input.icon !== undefined) updates.icon = input.icon;
    if (input.color !== undefined) updates.color = input.color;
    if (input.tags !== undefined) updates.tags = input.tags.map((t) => t.trim()).filter(Boolean);
    if (input.isFavorite !== undefined) updates.isFavorite = input.isFavorite;
    if (input.isArchived !== undefined) updates.isArchived = input.isArchived;
    if (input.isPinned !== undefined) updates.isPinned = input.isPinned;

    const updated: Project = { ...project, ...updates, updatedAt: Date.now() };
    await StorageEngine.saveProject(updated);
    return updated;
  },

  async delete(id: ProjectId): Promise<Project> {
    return this.update(id, { isArchived: false, isPinned: false, isFavorite: false });
  },

  async softDelete(id: ProjectId): Promise<Project> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) throw new Error('Project not found');
    const updated: Project = {
      ...project,
      isDeleted: true,
      deletedAt: Date.now(),
      isArchived: false,
      isPinned: false,
      isFavorite: false,
      updatedAt: Date.now(),
    };
    await StorageEngine.saveProject(updated);
    return updated;
  },

  async restore(id: ProjectId): Promise<Project> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) throw new Error('Project not found');
    const updated: Project = {
      ...project,
      isDeleted: false,
      deletedAt: null,
      updatedAt: Date.now(),
    };
    await StorageEngine.saveProject(updated);
    return updated;
  },

  async permanentDelete(id: ProjectId): Promise<void> {
    await StorageEngine.deleteProject(id);
  },

  async toggleFavorite(id: ProjectId): Promise<Project> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) throw new Error('Project not found');
    return this.update(id, { isFavorite: !project.isFavorite });
  },

  async togglePin(id: ProjectId): Promise<Project> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) throw new Error('Project not found');
    return this.update(id, { isPinned: !project.isPinned });
  },

  async toggleArchive(id: ProjectId): Promise<Project> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) throw new Error('Project not found');
    const updates: ProjectUpdateInput = { isArchived: !project.isArchived };
    if (updates.isArchived) {
      updates.isPinned = false;
    }
    return this.update(id, updates);
  },

  async open(id: ProjectId): Promise<Project> {
    const project = await StorageEngine.getProjectById(id);
    if (!project) throw new Error('Project not found');
    const updated: Project = { ...project, lastOpenedAt: Date.now(), updatedAt: Date.now() };
    await StorageEngine.saveProject(updated);
    return updated;
  },

  search(projects: Project[], query: ProjectSearchQuery): Project[] {
    let result = projects.filter((p) => !p.isDeleted);

    if (!query.includeArchived) {
      result = result.filter((p) => !p.isArchived);
    }

    const text = query.text.trim().toLowerCase();
    if (text) {
      result = result.filter((p) => {
        return (
          p.name.toLowerCase().includes(text) ||
          p.description.toLowerCase().includes(text) ||
          p.tags.some((t) => t.toLowerCase().includes(text))
        );
      });
    }

    switch (query.filter) {
      case 'favorites':
        result = result.filter((p) => p.isFavorite);
        break;
      case 'pinned':
        result = result.filter((p) => p.isPinned);
        break;
      case 'archived':
        result = result.filter((p) => p.isArchived);
        break;
      case 'recent':
        result = result.filter((p) => p.lastOpenedAt !== null);
        break;
    }

    switch (query.sort) {
      case 'newest':
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        result.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'recently-opened':
        result.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
        break;
      case 'alphabetical':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'most-active':
        result.sort((a, b) => b.stats.activityScore - a.stats.activityScore);
        break;
    }

    return result;
  },

  getStats(projects: Project[]) {
    const active = projects.filter((p) => !p.isDeleted && !p.isArchived);
    const archived = projects.filter((p) => p.isArchived && !p.isDeleted);
    const deleted = projects.filter((p) => p.isDeleted);
    const favorites = projects.filter((p) => p.isFavorite && !p.isDeleted && !p.isArchived);
    const pinned = projects.filter((p) => p.isPinned && !p.isDeleted && !p.isArchived);
    return {
      total: projects.length,
      active: active.length,
      archived: archived.length,
      deleted: deleted.length,
      favorites: favorites.length,
      pinned: pinned.length,
      totalConversations: active.reduce((s, p) => s + p.stats.conversationCount, 0),
      totalFiles: active.reduce((s, p) => s + p.stats.fileCount, 0),
      totalNotes: active.reduce((s, p) => s + p.stats.noteCount, 0),
      totalTasks: active.reduce((s, p) => s + p.stats.taskCount, 0),
    };
  },
};
