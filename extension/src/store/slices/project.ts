import type { UUID } from "../../types/omni";

/**
 * Project Slice — Reactive state for a single project.
 */

export interface ProjectSlice {
  id: UUID;
  name: string;
  description: string;
  color: string;
  icon: string;
  status: string;
  sortOrder: number;
  conversations: UUID[];
  files: ProjectFile[];
  notes: ProjectNote[];
  tasks: ProjectTask[];
  pinned: ProjectPinned[];
  connectors: ProjectConnector[];
  stats: ProjectStats;
  memory?: ProjectMemory;
}

export interface ProjectFile {
  id: UUID;
  name: string;
  type: string;
  size: number;
  url: string;
  createdAt: number;
}

export interface ProjectNote {
  id: UUID;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectTask {
  id: UUID;
  title: string;
  description: string;
  status: string;
  createdAt: number;
  completedAt?: number;
}

export interface ProjectPinned {
  id: UUID;
  type: string;
  title: string;
  createdAt: number;
}

export interface ProjectConnector {
  id: UUID;
  connectorId: string;
  name: string;
  status: string;
}

export interface ProjectStats {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  totalFiles: number;
  totalNotes: number;
  totalTasks: number;
  lastActivityAt: number;
}

export interface ProjectMemory {
  summary: string;
  keyDecisions: string[];
  openQuestions: string[];
  lastSummarizedAt: number;
}

export const initialProjectSlice: ProjectSlice = {
  id: "",
  name: "",
  description: "",
  color: "#7c3aed",
  icon: "folder",
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
    lastActivityAt: 0,
  },
};
