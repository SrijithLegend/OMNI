import type { UUID, Timestamp } from "../types/omni";

/**
 * Workspace — The heart of Omni.
 *
 * Contains the user's active project, recent activity, search index,
  * pinned items, connectors, and notifications. Everything revolves here.
 */

export interface Workspace {
  id: UUID;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Projects
  projects: UUID[];
  activeProjectId: UUID | null;
  recentProjectIds: UUID[]; // last 5

  // UI State
  lastView: string;
  sidebarOpen: boolean;
  sidebarWidth: number;

  // Recent Activity
  recentActivity: WorkspaceActivity[];

  // Search Index
  searchIndex: string[];

  // Pinned items (global)
  pinned: WorkspacePinned[];

  // Notifications
  notifications: WorkspaceNotification[];
  unreadCount: number;

  // Connectors
  connectorIds: string[];

  // Settings reference
  settingsId: UUID;

  // Analytics
  stats: WorkspaceStats;
}

export interface WorkspaceActivity {
  id: UUID;
  type: ActivityType;
  projectId: UUID | null;
  title: string;
  description: string;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

export type ActivityType =
  | "project-created"
  | "project-updated"
  | "project-archived"
  | "project-restored"
  | "conversation-captured"
  | "conversation-transferred"
  | "file-uploaded"
  | "note-created"
  | "note-updated"
  | "task-completed"
  | "connector-linked"
  | "connector-synced"
  | "connector-error"
  | "export-generated"
  | "ai-switched"
  | "settings-changed"
  | "error-occurred";

export interface WorkspacePinned {
  id: UUID;
  type: "project" | "conversation" | "note" | "file" | "snippet";
  title: string;
  targetId: UUID;
  timestamp: Timestamp;
}

export interface WorkspaceNotification {
  id: UUID;
  level: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: Timestamp;
  read: boolean;
  action?: {
    label: string;
    type: string;
    payload: Record<string, unknown>;
  };
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
  lastActivityAt: Timestamp;
}

export function createWorkspace(name: string = "My Workspace", settingsId: UUID): Workspace {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    projects: [],
    activeProjectId: null,
    recentProjectIds: [],
    lastView: "workspace",
    sidebarOpen: true,
    sidebarWidth: 280,
    recentActivity: [],
    searchIndex: [],
    pinned: [],
    notifications: [],
    unreadCount: 0,
    connectorIds: [],
    settingsId,
    stats: {
      totalProjects: 0,
      totalConversations: 0,
      totalMessages: 0,
      totalFiles: 0,
      totalNotes: 0,
      totalTasks: 0,
      totalExports: 0,
      totalTransfers: 0,
      lastActivityAt: now,
    },
  };
}
