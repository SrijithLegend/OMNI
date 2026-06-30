import type { UUID, Timestamp } from "../types/omni";

/**
 * Timeline — The audit trail of everything that happens in Omni.
 *
 * Every user action, every system event, every AI transfer is recorded.
 */

export interface TimelineEvent {
  id: UUID;
  type: TimelineEventType;
  category: TimelineCategory;
  projectId: UUID | null;
  conversationId: UUID | null;
  title: string;
  description: string;
  timestamp: Timestamp;
  metadata: TimelineMetadata;
  icon: string; // lucide icon name
  color: string; // hex color
}

export type TimelineEventType =
  | "project-created"
  | "project-updated"
  | "project-archived"
  | "project-restored"
  | "project-favourited"
  | "conversation-captured"
  | "conversation-transferred"
  | "conversation-exported"
  | "conversation-deleted"
  | "file-uploaded"
  | "file-deleted"
  | "note-created"
  | "note-updated"
  | "note-deleted"
  | "task-created"
  | "task-completed"
  | "task-deleted"
  | "connector-linked"
  | "connector-synced"
  | "connector-disconnected"
  | "connector-error"
  | "export-generated"
  | "export-downloaded"
  | "ai-switched"
  | "settings-changed"
  | "theme-changed"
  | "search-performed"
  | "error-occurred"
  | "user-logged-in"
  | "user-logged-out";

export type TimelineCategory =
  | "project"
  | "conversation"
  | "file"
  | "note"
  | "task"
  | "connector"
  | "export"
  | "system"
  | "user";

export interface TimelineMetadata {
  [key: string]: unknown;
}

export interface TimelineFilter {
  categories?: TimelineCategory[];
  types?: TimelineEventType[];
  projectId?: UUID;
  from?: Timestamp;
  to?: Timestamp;
  limit?: number;
  offset?: number;
}

export interface TimelinePage {
  events: TimelineEvent[];
  hasMore: boolean;
  total: number;
}

export function createTimelineEvent(
  type: TimelineEventType,
  category: TimelineCategory,
  title: string,
  description: string,
  projectId: UUID | null = null,
  conversationId: UUID | null = null,
  metadata: Record<string, unknown> = {},
): TimelineEvent {
  return {
    id: crypto.randomUUID(),
    type,
    category,
    projectId,
    conversationId,
    title,
    description,
    timestamp: Date.now(),
    metadata,
    icon: timelineEventIcon(type),
    color: timelineEventColor(type),
  };
}

function timelineEventIcon(type: TimelineEventType): string {
  const map: Record<string, string> = {
    "project-created": "folder-plus",
    "project-updated": "folder-edit",
    "project-archived": "folder-archive",
    "project-restored": "folder-open",
    "project-favourited": "star",
    "conversation-captured": "message-square",
    "conversation-transferred": "arrow-right-left",
    "conversation-exported": "download",
    "conversation-deleted": "trash-2",
    "file-uploaded": "file-up",
    "file-deleted": "file-x",
    "note-created": "file-text",
    "note-updated": "file-edit",
    "note-deleted": "file-x",
    "task-created": "circle-plus",
    "task-completed": "check-circle",
    "task-deleted": "trash-2",
    "connector-linked": "link",
    "connector-synced": "refresh-cw",
    "connector-disconnected": "unlink",
    "connector-error": "alert-triangle",
    "export-generated": "file-down",
    "export-downloaded": "download",
    "ai-switched": "bot",
    "settings-changed": "settings",
    "theme-changed": "palette",
    "search-performed": "search",
    "error-occurred": "alert-circle",
    "user-logged-in": "log-in",
    "user-logged-out": "log-out",
  };
  return map[type] || "circle";
}

function timelineEventColor(type: TimelineEventType): string {
  const map: Record<string, string> = {
    "project-created": "#7c3aed",
    "project-updated": "#8b5cf6",
    "project-archived": "#6b7280",
    "project-favourited": "#f59e0b",
    "conversation-captured": "#10b981",
    "conversation-transferred": "#3b82f6",
    "conversation-exported": "#06b6d4",
    "task-completed": "#22c55e",
    "connector-linked": "#8b5cf6",
    "connector-synced": "#10b981",
    "connector-error": "#ef4444",
    "error-occurred": "#ef4444",
    "settings-changed": "#6b7280",
  };
  return map[type] || "#7c3aed";
}
