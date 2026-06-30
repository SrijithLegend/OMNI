import { create } from 'zustand';
import { Project, ProjectId, ProjectCreateInput, ProjectUpdateInput, ProjectSearchQuery, ProjectFilter, ProjectSort } from '@/types';
import { ProjectEngine } from '@/engines';

interface ProjectStore {
  projects: Project[];
  selectedProjectId: ProjectId | null;
  searchQuery: ProjectSearchQuery;
  isLoading: boolean;
  error: string | null;

  filteredProjects: Project[];
  stats: ReturnType<typeof ProjectEngine.getStats>;
  recentProjects: Project[];
  pinnedProjects: Project[];
  favoriteProjects: Project[];
  archivedProjects: Project[];

  setSearchQuery: (query: Partial<ProjectSearchQuery>) => void;
  setSelectedProject: (id: ProjectId | null) => void;
  loadProjects: () => Promise<void>;
  createProject: (input: ProjectCreateInput) => Promise<Project>;
  updateProject: (id: ProjectId, input: ProjectUpdateInput) => Promise<Project>;
  softDeleteProject: (id: ProjectId) => Promise<void>;
  restoreProject: (id: ProjectId) => Promise<void>;
  permanentDeleteProject: (id: ProjectId) => Promise<void>;
  toggleFavorite: (id: ProjectId) => Promise<void>;
  togglePin: (id: ProjectId) => Promise<void>;
  toggleArchive: (id: ProjectId) => Promise<void>;
  openProject: (id: ProjectId) => Promise<Project>;
  clearError: () => void;
}

const defaultSearchQuery: ProjectSearchQuery = {
  text: '',
  filter: 'all',
  sort: 'newest',
  includeArchived: false,
  includeDeleted: false,
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  searchQuery: defaultSearchQuery,
  isLoading: false,
  error: null,

  filteredProjects: [],
  stats: ProjectEngine.getStats([]),
  recentProjects: [],
  pinnedProjects: [],
  favoriteProjects: [],
  archivedProjects: [],

  setSearchQuery: (query) => {
    const next = { ...get().searchQuery, ...query };
    set((state) => {
      const filtered = ProjectEngine.search(state.projects, next);
      return { searchQuery: next, filteredProjects: filtered };
    });
  },

  setSelectedProject: (id) => set({ selectedProjectId: id }),

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await ProjectEngine.list();
      const filtered = ProjectEngine.search(projects, get().searchQuery);
      const stats = ProjectEngine.getStats(projects);
      const active = projects.filter((p) => !p.isDeleted && !p.isArchived);
      set({
        projects,
        filteredProjects: filtered,
        stats,
        recentProjects: active
          .filter((p) => p.lastOpenedAt !== null)
          .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
          .slice(0, 6),
        pinnedProjects: active.filter((p) => p.isPinned).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)),
        favoriteProjects: active.filter((p) => p.isFavorite).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)),
        archivedProjects: projects.filter((p) => p.isArchived && !p.isDeleted),
        isLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load projects', isLoading: false });
    }
  },

  createProject: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const project = await ProjectEngine.create(input);
      await get().loadProjects();
      set({ isLoading: false });
      return project;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create project', isLoading: false });
      throw err;
    }
  },

  updateProject: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const project = await ProjectEngine.update(id, input);
      await get().loadProjects();
      set({ isLoading: false });
      return project;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update project', isLoading: false });
      throw err;
    }
  },

  softDeleteProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await ProjectEngine.softDelete(id);
      if (get().selectedProjectId === id) {
        set({ selectedProjectId: null });
      }
      await get().loadProjects();
      set({ isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete project', isLoading: false });
    }
  },

  restoreProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await ProjectEngine.restore(id);
      await get().loadProjects();
      set({ isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to restore project', isLoading: false });
    }
  },

  permanentDeleteProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await ProjectEngine.permanentDelete(id);
      if (get().selectedProjectId === id) {
        set({ selectedProjectId: null });
      }
      await get().loadProjects();
      set({ isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete project', isLoading: false });
    }
  },

  toggleFavorite: async (id) => {
    try {
      await ProjectEngine.toggleFavorite(id);
      await get().loadProjects();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to toggle favorite' });
    }
  },

  togglePin: async (id) => {
    try {
      await ProjectEngine.togglePin(id);
      await get().loadProjects();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to toggle pin' });
    }
  },

  toggleArchive: async (id) => {
    try {
      await ProjectEngine.toggleArchive(id);
      await get().loadProjects();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to toggle archive' });
    }
  },

  openProject: async (id) => {
    try {
      const project = await ProjectEngine.open(id);
      await get().loadProjects();
      return project;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to open project' });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
