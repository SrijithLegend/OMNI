export type ProjectId = string;

export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  icon: string;
  color: string;
  tags: string[];
  template: ProjectTemplate | null;
  isFavorite: boolean;
  isArchived: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
  stats: ProjectStats;
  metadata: ProjectMetadata;
  future: ProjectFuture;
}

export interface ProjectStats {
  conversationCount: number;
  fileCount: number;
  noteCount: number;
  taskCount: number;
  totalTokens: number;
  totalTime: number;
  activityScore: number;
}

export interface ProjectMetadata {
  url: string | null;
  language: string | null;
  framework: string | null;
  version: string | null;
  custom: Record<string, string>;
}

export interface ProjectFuture {
  aiMemory: string[];
  connectorIds: string[];
  conversationIds: string[];
  noteIds: string[];
  taskIds: string[];
  timelineIds: string[];
  fileIds: string[];
}

export type ProjectTemplate =
  | 'software'
  | 'research'
  | 'startup'
  | 'college'
  | 'personal'
  | 'blank';

export interface ProjectTemplateConfig {
  id: ProjectTemplate;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultTags: string[];
  defaultMetadata: Partial<ProjectMetadata>;
}

export type ProjectFilter =
  | 'all'
  | 'favorites'
  | 'pinned'
  | 'archived'
  | 'recent';

export type ProjectSort =
  | 'newest'
  | 'oldest'
  | 'recently-opened'
  | 'alphabetical'
  | 'most-active';

export interface ProjectSearchQuery {
  text: string;
  filter: ProjectFilter;
  sort: ProjectSort;
  includeArchived: boolean;
  includeDeleted: boolean;
}

export interface ProjectCreateInput {
  name: string;
  description: string;
  icon?: string;
  color?: string;
  tags?: string[];
  template?: ProjectTemplate;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  tags?: string[];
  isFavorite?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
}

export interface ProjectState {
  projects: Project[];
  selectedProjectId: ProjectId | null;
  searchQuery: ProjectSearchQuery;
  isLoading: boolean;
  error: string | null;
}

export type ProjectAction =
  | { type: 'CREATE_PROJECT'; input: ProjectCreateInput }
  | { type: 'UPDATE_PROJECT'; id: ProjectId; input: ProjectUpdateInput }
  | { type: 'DELETE_PROJECT'; id: ProjectId }
  | { type: 'RESTORE_PROJECT'; id: ProjectId }
  | { type: 'PERMANENT_DELETE_PROJECT'; id: ProjectId }
  | { type: 'OPEN_PROJECT'; id: ProjectId }
  | { type: 'SET_SEARCH'; query: Partial<ProjectSearchQuery> }
  | { type: 'SET_SELECTED'; id: ProjectId | null }
  | { type: 'LOAD_PROJECTS'; projects: Project[] }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null };

export const PROJECT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#14b8a6', '#6366f1', '#f97316',
  '#84cc16', '#d946ef', '#0ea5e9', '#f43f5e', '#78716c',
];

export const PROJECT_ICONS = [
  'Code', 'FileText', 'Rocket', 'GraduationCap', 'User',
  'Briefcase', 'FlaskConical', 'Globe', 'Star', 'Zap',
  'Heart', 'Target', 'Lightbulb', 'Palette', 'Shield',
  'Database', 'Terminal', 'BookOpen', 'Coffee', 'Music',
  'Camera', 'ShoppingBag', 'BarChart', 'Settings', 'Home',
];
