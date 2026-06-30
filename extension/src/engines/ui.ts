/**
 * UI Engine — Manages UI state, transitions, and component coordination.
 *
 * Bridges engine state to React components via events.
 */

import { BaseEngine } from "./base";

export type ViewState = "workspace" | "project" | "transfer" | "settings" | "search" | "timeline" | "history" | "compare" | "export";

export interface ToastMessage {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  duration: number;
}

export class UIEngine extends BaseEngine {
  private view: ViewState = "workspace";
  private loading = false;
  private loadingMessage = "";
  private toasts: ToastMessage[] = [];
  private modals: string[] = [];

  constructor() {
    super({ name: "UIEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.toasts = [];
    this.modals = [];
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: true,
      message: `UI: view=${this.view}, toasts=${this.toasts.length}`,
      timestamp: Date.now(),
    };
  }

  setView(view: ViewState): void {
    this.view = view;
    this.emit("view-changed", view);
  }

  getView(): ViewState {
    return this.view;
  }

  setLoading(loading: boolean, message?: string): void {
    this.loading = loading;
    this.loadingMessage = message ?? "";
    this.emit("loading-changed", { loading, message: this.loadingMessage });
  }

  isLoading(): boolean {
    return this.loading;
  }

  showToast(type: ToastMessage["type"], title: string, message: string, duration = 3000): void {
    const toast: ToastMessage = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      duration,
    };
    this.toasts.push(toast);
    this.emit("toast", toast);

    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== toast.id);
      this.emit("toast-dismissed", toast.id);
    }, duration);
  }

  openModal(id: string): void {
    this.modals.push(id);
    this.emit("modal-opened", id);
  }

  closeModal(id: string): void {
    this.modals = this.modals.filter((m) => m !== id);
    this.emit("modal-closed", id);
  }

  closeAllModals(): void {
    this.modals = [];
    this.emit("modals-cleared");
  }
}
