import type { UUID, Timestamp } from "../types/omni";

/**
 * Search — Architecture for the future Search Engine.
 *
 * Searchable objects: Projects, Conversations, Files, Notes, Tasks, Timeline, Pinned, Snippets.
 */

export interface SearchIndex {
  version: string;
  updatedAt: Timestamp;
  entries: SearchEntry[];
}

export interface SearchEntry {
  id: UUID;
  type: SearchableType;
  title: string;
  content: string;
  tags: string[];
  projectId: UUID | null;
  timestamp: Timestamp;
  score: number;
}

export type SearchableType =
  | "project"
  | "conversation"
  | "file"
  | "note"
  | "task"
  | "timeline"
  | "pinned"
  | "snippet";

export interface SearchQuery {
  q: string;
  types?: SearchableType[];
  projectId?: UUID;
  from?: Timestamp;
  to?: Timestamp;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  entries: SearchEntry[];
  total: number;
  query: string;
  duration: number;
  suggestions: string[];
}

export interface SearchFilter {
  projects?: UUID[];
  platforms?: string[];
  dateRange?: { from: Timestamp; to: Timestamp };
  hasAttachments?: boolean;
}
