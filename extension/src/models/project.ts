import type { UUID, Timestamp, Platform } from "../types/omni";

/**
 * Project — The primary container for work in Omni.
 *
 * Every project is a workspace within the workspace.
 * It contains conversations, files, notes, tasks, and metadata.
 */

export interface Project {
  id: UUID;
  name: string;
  description: string;
  color: string; // hex color
  icon: string; // lucide icon name
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: ProjectStatus;
  sortOrder: number;

  // Relationships
  conversations: UUID[];
  files: ProjectFile[];
  notes: ProjectNote[];
  tasks: ProjectTask[];
  pinned: ProjectPinned[];
  connectors: ProjectConnector[];

  // Analytics
  stats: ProjectStats;

  // AI memory for future use
  memory?: ProjectMemory;
}

export type ProjectStatus = "active" | "archived" | "favourite";

export interface ProjectFile {
  id: UUID;
  name: string;
  type: string;
  size: number;
  url: string;
  createdAt: Timestamp;
}

export interface ProjectNote {
  id: UUID;
  title: string;
  content: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProjectTask {
  id: UUID;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed";
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export interface ProjectPinned {
  id: UUID;
  type: "conversation" | "note" | "file" | "snippet";
  title: string;
  createdAt: Timestamp;
}

export interface ProjectConnector {
  id: UUID;
  connectorId: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  lastSyncAt?: Timestamp;
}

export interface ProjectStats {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  totalFiles: number;
  totalNotes: number;
  totalTasks: number;
  lastActivityAt: Timestamp;
}

export interface ProjectMemory {
  summary: string;
  keyDecisions: string[];
  openQuestions: string[];
  lastSummarizedAt: Timestamp;
}

export function createProject(name: string, color?: string, icon?: string): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    description: "",
    color: color ?? "#7c3aed",
    icon: icon ?? "folder",
    createdAt: now,
    updatedAt: now,
    status: "active",
    sortOrder: 0,
    conversations: [],
    files: [],
    notes: [],
    tasks: [],
    pinned: [],
    connectors: [],
    stats: {
      totalConversations: 0,
      totalMessages: 0,
      totalTokens: 0,
      totalFiles: 0,
      totalNotes: 0,
      totalTasks: 0,
      lastActivityAt: now,
    },
  };
}
