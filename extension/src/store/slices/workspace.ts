import type { UUID } from "../../types/omni";

/**
 * Workspace Slice — Workspace-specific reactive state.
 */

export interface WorkspaceSlice {
  id: UUID;
  name: string;
  projects: UUID[];
  activeProjectId: UUID | null;
  recentProjectIds: UUID[];
  recentActivity: Activity[];
  searchIndex: string[];
  pinned: PinnedItem[];
  notifications: Notification[];
  unreadCount: number;
  connectorIds: string[];
  stats: WorkspaceStats;
}

export interface Activity {
  id: string;
  type: string;
  projectId: UUID | null;
  title: string;
  description: string;
  timestamp: number;
}

export interface PinnedItem {
  id: string;
  type: string;
  title: string;
  targetId: string;
  timestamp: number;
}

export interface Notification {
  id: string;
  level: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface WorkspaceStats {
  totalProjects: number;
  totalConversations: number;
  totalMessages: number;
  totalFiles: number;
  totalNotes: number;
  totalTasks: number;
  totalExports: number;
  totalTransfers: number;
}

export const initialWorkspaceSlice: WorkspaceSlice = {
  id: "",
  name: "",
  projects: [],
  activeProjectId: null,
  recentProjectIds: [],
  recentActivity: [],
  searchIndex: [],
  pinned: [],
  notifications: [],
  unreadCount: 0,
  connectorIds: [],
  stats: {
    totalProjects: 0,
    totalConversations: 0,
    totalMessages: 0,
    totalFiles: 0,
    totalNotes: 0,
    totalTasks: 0,
    totalExports: 0,
    totalTransfers: 0,
  },
};
