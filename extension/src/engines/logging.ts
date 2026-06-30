/**
 * Logging Engine — Centralized logging with levels, metadata, and error boundaries.
 */

import { BaseEngine } from "./base";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class LoggingEngine extends BaseEngine {
  private logs: LogEntry[] = [];
  private maxSize = 500;
  private minLevel: LogLevel = "warn";
  private buffer: LogEntry[] = [];
  private flushInterval: number | null = null;

  constructor() {
    super({ name: "LoggingEngine", version: "1.0.0", debug: true });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.flushInterval = window.setInterval(() => this.flush(), 5000);
    this.emit("ready");
  }

  async stop(): Promise<void> {
    if (this.flushInterval) clearInterval(this.flushInterval);
    await this.flush();
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: true,
      message: `Logging: ${this.logs.length} entries, minLevel=${this.minLevel}`,
      timestamp: Date.now(),
    };
  }

  log(level: LogLevel, source: string, message: string, context?: Record<string, unknown>): void {
    if (this.levelValue(level) < this.levelValue(this.minLevel)) return;

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      source,
      message,
      context,
    };

    this.buffer.push(entry);
    this.emit("log", entry);

    // Also console log for debugging
    const prefix = `[${source}]`;
    if (level === "error" || level === "fatal") console.error(prefix, message, context);
    else if (level === "warn") console.warn(prefix, message, context);
    else if (level === "debug") console.debug(prefix, message, context);
    else console.info(prefix, message, context);
  }

  error(source: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log("error", source, message, {
      ...context,
      error: error
        ? { name: error.name, message: error.message, stack: error.stack }
        : undefined,
    });
  }

  getLogs(filter?: { level?: LogLevel; source?: string; from?: number; to?: number }): LogEntry[] {
    let filtered = [...this.logs, ...this.buffer];
    if (filter?.level) filtered = filtered.filter((l) => this.levelValue(l.level) >= this.levelValue(filter.level!));
    if (filter?.source) filtered = filtered.filter((l) => l.source === filter.source);
    if (filter?.from) filtered = filtered.filter((l) => l.timestamp >= filter.from!);
    if (filter?.to) filtered = filtered.filter((l) => l.timestamp <= filter.to!);
    return filtered;
  }

  async clear(): Promise<void> {
    this.logs = [];
    this.buffer = [];
    this.emit("cleared");
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    this.logs.push(...this.buffer);
    this.buffer = [];
    if (this.logs.length > this.maxSize) {
      this.logs = this.logs.slice(-this.maxSize);
    }
  }

  private levelValue(level: LogLevel): number {
    const values: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
    return values[level];
  }
}
