/**
 * Timeline Engine — Audit trail for all Omni events.
 */

import { BaseEngine, getEngine } from "./base";
import type { TimelineEvent, TimelineFilter, TimelinePage } from "../models/timeline";
import { createTimelineEvent } from "../models/timeline";
import type { StorageEngine } from "./storage";
import { STORAGE_KEYS_REF } from "./storage";

export class TimelineEngine extends BaseEngine {
  private events: TimelineEvent[] = [];
  private storage: StorageEngine | null = null;

  constructor() {
    super({ name: "TimelineEngine", version: "1.0.0", debug: false });
    this.dependsOn("StorageEngine");
  }

  async start(): Promise<void> {
    this.storage = getEngine<StorageEngine>("StorageEngine");
    if (!this.storage) throw new Error("StorageEngine not available");
    const saved = await this.storage.get<TimelineEvent[]>(STORAGE_KEYS_REF.TIMELINE);
    if (saved) this.events = saved;
    this.isRunning = true;
    this.emit("ready", { count: this.events.length });
  }

  async stop(): Promise<void> {
    await this.save();
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: true,
      message: `Timeline: ${this.events.length} events`,
      timestamp: Date.now(),
    };
  }

  async add(
    type: TimelineEvent["type"],
    category: TimelineEvent["category"],
    title: string,
    description: string,
    projectId: string | null = null,
    conversationId: string | null = null,
    metadata: Record<string, unknown> = {},
  ): Promise<TimelineEvent> {
    const event = createTimelineEvent(type, category, title, description, projectId, conversationId, metadata);
    this.events.unshift(event);
    if (this.events.length > 5000) this.events = this.events.slice(0, 5000);
    await this.save();
    this.emit("event", event);
    return event;
  }

  get(filter?: TimelineFilter): TimelinePage {
    let filtered = this.events;
    if (filter?.categories) {
      filtered = filtered.filter((e) => filter.categories!.includes(e.category));
    }
    if (filter?.types) {
      filtered = filtered.filter((e) => filter.types!.includes(e.type));
    }
    if (filter?.projectId) {
      filtered = filtered.filter((e) => e.projectId === filter.projectId);
    }
    if (filter?.from) {
      filtered = filtered.filter((e) => e.timestamp >= filter.from!);
    }
    if (filter?.to) {
      filtered = filtered.filter((e) => e.timestamp <= filter.to!);
    }

    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      events: paginated,
      hasMore: filtered.length > offset + limit,
      total: filtered.length,
    };
  }

  async clear(): Promise<void> {
    this.events = [];
    await this.save();
    this.emit("cleared");
  }

  private async save(): Promise<void> {
    if (!this.storage) return;
    await this.storage.set(STORAGE_KEYS_REF.TIMELINE, this.events);
  }
}
