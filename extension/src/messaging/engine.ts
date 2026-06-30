/**
 * Messaging Engine — Centralized, typed communication for all extension contexts.
 *
 * Features: send, broadcast, listen, request, reply, queue, logging.
 * Every message is typed. No string-based messages anywhere.
 */

import { BaseEngine, registerEngine, getEngine } from "../engines/base";
import type { OmniMessage, OmniResponse, MessageType, MessageTarget, MessageQueueEntry } from "./types";

const MESSAGE_TIMEOUT = 30000;
const MAX_QUEUE_SIZE = 100;

interface MessagingConfig {
  debug: boolean;
  logMessages: boolean;
}

export class MessagingEngine extends BaseEngine {
  private handlers = new Map<MessageType, Set<(msg: OmniMessage, reply: (r: OmniResponse) => void) => void>>();
  private queue: MessageQueueEntry[] = [];
  private pending = new Map<string, MessageQueueEntry>();
  private config: MessagingConfig;
  private messageId = 0;

  constructor(config: Partial<MessagingConfig> = {}) {
    super({ name: "MessagingEngine", version: "1.0.0", debug: config.debug ?? false });
    this.config = {
      debug: config.debug ?? false,
      logMessages: config.logMessages ?? false,
    };
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.log("info", "Messaging engine started");
  }

  async stop(): Promise<void> {
    // Clear all pending requests
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timeoutId);
      entry.reject(new Error("Messaging engine stopped"));
    }
    this.pending.clear();
    this.queue.length = 0;
    this.handlers.clear();
    this.isRunning = false;
    this.log("info", "Messaging engine stopped");
  }

  async health(): Promise<import("../engines/base").HealthStatus> {
    return {
      ok: true,
      message: `Messaging: ${this.handlers.size} handlers, ${this.pending.size} pending, ${this.queue.length} queued`,
      timestamp: Date.now(),
    };
  }

  /** Generate a unique message ID. */
  private genId(): string {
    return `msg_${Date.now()}_${++this.messageId}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Send a message without waiting for a response. */
  send<TPayload>(type: MessageType, payload: TPayload, options: {
    sender?: MessageTarget;
    recipient?: MessageTarget;
    traceId?: string;
  } = {}): OmniMessage<TPayload> {
    const message: OmniMessage<TPayload> = {
      type,
      payload,
      sender: options.sender ?? "background",
      recipient: options.recipient ?? "content",
      id: this.genId(),
      timestamp: Date.now(),
      traceId: options.traceId,
      requiresResponse: false,
    };

    if (this.config.logMessages) {
      this.log("debug", "SEND", message.type, message.id);
    }

    this.deliver(message);
    return message;
  }

  /** Send a message and wait for a response. */
  async request<TPayload, TResult>(type: MessageType, payload: TPayload, options: {
    sender?: MessageTarget;
    recipient?: MessageTarget;
    traceId?: string;
    timeout?: number;
  } = {}): Promise<TResult> {
    const message: OmniMessage<TPayload> = {
      type,
      payload,
      sender: options.sender ?? "background",
      recipient: options.recipient ?? "content",
      id: this.genId(),
      timestamp: Date.now(),
      traceId: options.traceId,
      requiresResponse: true,
    };

    if (this.config.logMessages) {
      this.log("debug", "REQUEST", message.type, message.id);
    }

    return new Promise<TResult>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pending.delete(message.id);
        reject(new Error(`Request timeout: ${type} (${message.id})`));
      }, options.timeout ?? MESSAGE_TIMEOUT);

      const entry: MessageQueueEntry = {
        message,
        resolve: (response) => {
          clearTimeout(timeoutId);
          if (response.success && response.data !== undefined) {
            resolve(response.data as TResult);
          } else {
            reject(new Error(response.error?.message ?? "Request failed"));
          }
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
        sentAt: Date.now(),
        timeoutId,
      };

      this.pending.set(message.id, entry);
      this.deliver(message);
    });
  }

  /** Broadcast a message to all listeners. */
  broadcast<TPayload>(type: MessageType, payload: TPayload, options: {
    sender?: MessageTarget;
    traceId?: string;
  } = {}): void {
    const message: OmniMessage<TPayload> = {
      type,
      payload,
      sender: options.sender ?? "background",
      recipient: "all",
      id: this.genId(),
      timestamp: Date.now(),
      traceId: options.traceId,
      requiresResponse: false,
    };

    if (this.config.logMessages) {
      this.log("debug", "BROADCAST", message.type, message.id);
    }

    this.emit("broadcast", message);
    this.deliver(message);
  }

  /** Listen for messages of a specific type. */
  listen<TPayload, TResult>(type: MessageType, handler: (msg: OmniMessage<TPayload>) => TResult | Promise<TResult>): () => void {
    const wrapped = (msg: OmniMessage, reply: (r: OmniResponse) => void) => {
      try {
        const result = handler(msg as OmniMessage<TPayload>);
        if (result instanceof Promise) {
          result.then((data) => {
            reply({
              id: msg.id,
              type: msg.type,
              success: true,
              data,
              timestamp: Date.now(),
            });
          }).catch((err) => {
            reply({
              id: msg.id,
              type: msg.type,
              success: false,
              error: { code: "HANDLER_ERROR", message: err.message },
              timestamp: Date.now(),
            });
          });
        } else {
          reply({
            id: msg.id,
            type: msg.type,
            success: true,
            data: result,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        reply({
          id: msg.id,
          type: msg.type,
          success: false,
          error: { code: "HANDLER_ERROR", message: (err as Error).message },
          timestamp: Date.now(),
        });
      }
    };

    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(wrapped);

    return () => {
      this.handlers.get(type)?.delete(wrapped);
    };
  }

  /** Reply to a specific message. */
  reply(messageId: string, success: boolean, data?: unknown, error?: { code: string; message: string }): void {
    const entry = this.pending.get(messageId);
    if (!entry) return;

    const response: OmniResponse = {
      id: messageId,
      type: entry.message.type,
      success,
      data,
      error,
      timestamp: Date.now(),
    };

    if (this.config.logMessages) {
      this.log("debug", "REPLY", response.type, response.id, success ? "OK" : "ERR");
    }

    entry.resolve(response);
    this.pending.delete(messageId);
  }

  /** Queue a message for later processing. */
  queue<TPayload>(type: MessageType, payload: TPayload, priority = 0): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.log("warn", "Queue full, dropping oldest message");
      this.queue.shift();
    }

    const message: OmniMessage<TPayload> = {
      type,
      payload,
      sender: "background",
      recipient: "background",
      id: this.genId(),
      timestamp: Date.now(),
      requiresResponse: false,
    };

    const entry: MessageQueueEntry = {
      message,
      resolve: () => {},
      reject: () => {},
      sentAt: Date.now(),
      timeoutId: 0,
    };

    // Insert by priority (higher = earlier)
    const idx = this.queue.findIndex((e) => priority > 0);
    this.queue.splice(idx === -1 ? this.queue.length : idx, 0, entry);

    this.log("debug", "QUEUED", type, message.id, `queue=${this.queue.length}`);
  }

  /** Process queued messages. */
  async processQueue(batchSize = 10): Promise<void> {
    const batch = this.queue.splice(0, batchSize);
    for (const entry of batch) {
      try {
        this.deliver(entry.message);
      } catch (err) {
        this.log("error", "Queue delivery failed", err);
      }
    }
  }

  /** Get current queue status. */
  getQueueStatus(): { length: number; pending: number; oldest: number | null } {
    return {
      length: this.queue.length,
      pending: this.pending.size,
      oldest: this.queue.length > 0 ? this.queue[0].sentAt : null,
    };
  }

  /** Deliver a message to internal handlers. */
  private deliver<TPayload>(message: OmniMessage<TPayload>): void {
    const handlers = this.handlers.get(message.type);
    if (!handlers) {
      this.log("debug", "No handlers for", message.type);
      return;
    }

    handlers.forEach((h) => {
      try {
        h(message, (response) => {
          this.reply(message.id, response.success, response.data, response.error);
        });
      } catch (err) {
        this.log("error", "Handler error for", message.type, err);
      }
    });
  }

  /** Handle an incoming message from Chrome runtime. */
  handleRuntimeMessage<TPayload, TResult>(message: OmniMessage<TPayload>, sendResponse: (response: TResult) => void): boolean {
    const handlers = this.handlers.get(message.type);
    if (!handlers) {
      this.log("debug", "No runtime handler for", message.type);
      return false;
    }

    handlers.forEach((h) => {
      try {
        h(message, (response) => {
          sendResponse(response.data as TResult);
        });
      } catch (err) {
        this.log("error", "Runtime handler error", err);
        sendResponse({ error: (err as Error).message } as TResult);
      }
    });

    return true;
  }

  /** Get all registered handler types. */
  getHandlerTypes(): MessageType[] {
    return Array.from(this.handlers.keys());
  }

  /** Get pending request count. */
  getPendingCount(): number {
    return this.pending.size;
  }
}
