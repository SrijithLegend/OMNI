/**
 * Settings Engine — Scalable settings architecture.
 */

import { BaseEngine, getEngine } from "./base";
import type { Settings } from "../models/settings";
import { DEFAULT_SETTINGS } from "../models/settings";
import type { StorageEngine } from "./storage";
import { STORAGE_KEYS_REF } from "./storage";

export class SettingsEngine extends BaseEngine {
  private settings: Settings | null = null;
  private storage: StorageEngine | null = null;

  constructor() {
    super({ name: "SettingsEngine", version: "1.0.0", debug: false });
    this.dependsOn("StorageEngine");
  }

  async start(): Promise<void> {
    this.storage = getEngine<StorageEngine>("StorageEngine");
    if (!this.storage) throw new Error("StorageEngine not available");
    const saved = await this.storage.get<Settings>(STORAGE_KEYS_REF.SETTINGS);
    this.settings = saved ?? { ...DEFAULT_SETTINGS, id: crypto.randomUUID() };
    this.isRunning = true;
    this.emit("ready", this.settings);
  }

  async stop(): Promise<void> {
    await this.save();
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: !!this.settings,
      message: this.settings ? `Settings v${this.settings.version}` : "No settings",
      timestamp: Date.now(),
    };
  }

  getSettings(): Settings | null {
    return this.settings;
  }

  async update<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    if (!this.settings) return;
    this.settings[key] = value;
    this.settings.updatedAt = Date.now();
    await this.save();
    this.emit("change", { key, value });
  }

  async reset(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, id: this.settings?.id ?? crypto.randomUUID() };
    await this.save();
    this.emit("reset", this.settings);
  }

  async export(): Promise<Settings> {
    if (!this.settings) throw new Error("No settings");
    return JSON.parse(JSON.stringify(this.settings));
  }

  async import(data: Settings): Promise<void> {
    this.settings = data;
    this.settings.updatedAt = Date.now();
    await this.save();
    this.emit("import", this.settings);
  }

  private async save(): Promise<void> {
    if (!this.settings || !this.storage) return;
    await this.storage.set(STORAGE_KEYS_REF.SETTINGS, this.settings);
  }
}
