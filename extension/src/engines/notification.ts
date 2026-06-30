/**
 * Notification Engine — Manages in-app and system notifications.
 */

import { BaseEngine } from "./base";

export interface Notification {
  id: string;
  level: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    type: string;
    payload: Record<string, unknown>;
  };
}

export class NotificationEngine extends BaseEngine {
  private notifications: Notification[] = [];
  private maxSize = 100;

  constructor() {
    super({ name: "NotificationEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.notifications = [];
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    const unread = this.notifications.filter((n) => !n.read).length;
    return {
      ok: true,
      message: `Notifications: ${this.notifications.length} total, ${unread} unread`,
      timestamp: Date.now(),
    };
  }

  async notify(level: Notification["level"], title: string, message: string, action?: Notification["action"]): Promise<Notification> {
    const notification: Notification = {
      id: crypto.randomUUID(),
      level,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      action,
    };
    this.notifications.unshift(notification);
    if (this.notifications.length > this.maxSize) {
      this.notifications = this.notifications.slice(0, this.maxSize);
    }
    this.emit("notification", notification);
    return notification;
  }

  getAll(): Notification[] {
    return [...this.notifications];
  }

  getUnread(): Notification[] {
    return this.notifications.filter((n) => !n.read);
  }

  async markRead(id: string): Promise<void> {
    const n = this.notifications.find((n) => n.id === id);
    if (n) {
      n.read = true;
      this.emit("read", id);
    }
  }

  async markAllRead(): Promise<void> {
    this.notifications.forEach((n) => (n.read = true));
    this.emit("all-read");
  }

  async dismiss(id: string): Promise<void> {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.emit("dismissed", id);
  }

  async clear(): Promise<void> {
    this.notifications = [];
    this.emit("cleared");
  }
}
