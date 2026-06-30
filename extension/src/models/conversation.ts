import type { UUID, Timestamp, Platform } from "../types/omni";

/**
 * Conversation — A captured chat from any AI platform.
 */
export interface Conversation {
  id: UUID;
  projectId: UUID | null;
  source: Platform;
  url: string;
  title: string;
  messages: ConversationMessage[];
  capturedAt: Timestamp;
  updatedAt: Timestamp;
  truncated: boolean;
  totalChars: number;
  metadata: ConversationMetadata;
}

export interface ConversationMessage {
  id: UUID;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Timestamp;
  platform: Platform;
  // For code blocks, attachments, etc.
  artifacts?: MessageArtifact[];
}

export interface MessageArtifact {
  type: "code" | "file" | "link" | "image";
  language?: string;
  content: string;
  filename?: string;
}

export interface ConversationMetadata {
  sourceUrl: string;
  sourceTitle: string;
  captureMethod: "auto" | "manual" | "paste";
  platformVersion?: string;
}

export function createConversation(
  source: Platform,
  url: string,
  messages: ConversationMessage[],
  projectId: UUID | null = null,
): Conversation {
  const now = Date.now();
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return {
    id: crypto.randomUUID(),
    projectId,
    source,
    url,
    title: `Conversation from ${source}`,
    messages,
    capturedAt: now,
    updatedAt: now,
    truncated: false,
    totalChars,
    metadata: {
      sourceUrl: url,
      sourceTitle: "",
      captureMethod: "manual",
    },
  };
}

export function createMessage(
  role: "user" | "assistant" | "system",
  content: string,
  platform: Platform,
): ConversationMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    platform,
  };
}
