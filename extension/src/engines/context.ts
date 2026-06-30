/**
 * Context Engine — Captures and manages AI conversation context.
 *
 * Handles scraping, parsing, and structuring conversation data from
 * all supported AI platforms.
 */

import { BaseEngine } from "./base";
import type { Conversation, ConversationMessage } from "../models/conversation";
import { createConversation, createMessage } from "../models/conversation";
import type { Platform } from "../types/omni";

export class ContextEngine extends BaseEngine {
  private captures: Map<string, Conversation> = new Map();

  constructor() {
    super({ name: "ContextEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.captures.clear();
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: true,
      message: `Context: ${this.captures.size} captures in memory`,
      timestamp: Date.now(),
    };
  }

  async capture(
    source: Platform,
    url: string,
    messages: ConversationMessage[],
    projectId: string | null = null,
  ): Promise<Conversation> {
    const conversation = createConversation(source, url, messages, projectId);
    this.captures.set(conversation.id, conversation);
    this.emit("captured", conversation);
    return conversation;
  }

  get(id: string): Conversation | null {
    return this.captures.get(id) ?? null;
  }

  getAll(): Conversation[] {
    return Array.from(this.captures.values());
  }

  delete(id: string): boolean {
    const removed = this.captures.delete(id);
    if (removed) this.emit("deleted", id);
    return removed;
  }

  async clear(): Promise<void> {
    this.captures.clear();
    this.emit("cleared");
  }

  getRecent(limit = 10): Conversation[] {
    return this.getAll()
      .sort((a, b) => b.capturedAt - a.capturedAt)
      .slice(0, limit);
  }
}
