/**
 * Search Engine — Architecture for future full-text search.
 *
 * Searchable: Projects, Conversations, Files, Notes, Tasks, Timeline, Pinned, Snippets.
 */

import { BaseEngine } from "./base";
import type { SearchEntry, SearchQuery, SearchResult, SearchFilter } from "../models/search";

export class SearchEngine extends BaseEngine {
  private index: Map<string, SearchEntry> = new Map();

  constructor() {
    super({ name: "SearchEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.index.clear();
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: true,
      message: `Search: ${this.index.size} indexed entries`,
      timestamp: Date.now(),
    };
  }

  async indexEntry(entry: SearchEntry): Promise<void> {
    this.index.set(entry.id, entry);
    this.emit("indexed", entry);
  }

  async indexBatch(entries: SearchEntry[]): Promise<void> {
    for (const entry of entries) {
      this.index.set(entry.id, entry);
    }
    this.emit("indexed-batch", { count: entries.length });
  }

  async removeEntry(id: string): Promise<void> {
    this.index.delete(id);
    this.emit("removed", id);
  }

  async search(query: SearchQuery, filter?: SearchFilter): Promise<SearchResult> {
    const start = performance.now();
    const q = query.q.toLowerCase().trim();
    let results = Array.from(this.index.values()).filter((entry) => {
      const matchesText = entry.title.toLowerCase().includes(q) || entry.content.toLowerCase().includes(q);
      const matchesType = !query.types || query.types.includes(entry.type);
      const matchesProject = !query.projectId || entry.projectId === query.projectId;
      const matchesDate = (!query.from || entry.timestamp >= query.from) && (!query.to || entry.timestamp <= query.to);
      return matchesText && matchesType && matchesProject && matchesDate;
    });

    // Simple scoring
    results = results.sort((a, b) => b.score - a.score);
    const total = results.length;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    results = results.slice(offset, offset + limit);

    const duration = Math.round(performance.now() - start);
    return {
      entries: results,
      total,
      query: query.q,
      duration,
      suggestions: [],
    };
  }

  async rebuild(): Promise<void> {
    this.index.clear();
    this.emit("rebuilt");
  }

  getStats(): { total: number; types: Record<string, number> } {
    const types: Record<string, number> = {};
    for (const entry of this.index.values()) {
      types[entry.type] = (types[entry.type] || 0) + 1;
    }
    return { total: this.index.size, types };
  }
}
