/**
 * Connector Engine — Framework for third-party integrations.
 *
 * Every connector must implement: connect(), disconnect(), health(), sync(), execute(), status(), metadata().
 */

import { BaseEngine } from "./base";
import type { Connector, ConnectorMetadata, ConnectorFramework } from "../models/connector";
import { BUILT_IN_CONNECTORS } from "../models/connector";

export class ConnectorEngine extends BaseEngine {
  private connectors: Map<string, Connector> = new Map();
  private frameworks: Map<string, ConnectorFramework> = new Map();
  private metadata: Map<string, ConnectorMetadata> = new Map();

  constructor() {
    super({ name: "ConnectorEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    // Register built-in connector metadata
    for (const meta of BUILT_IN_CONNECTORS) {
      this.metadata.set(meta.id, meta);
    }
    this.isRunning = true;
    this.emit("ready", { available: BUILT_IN_CONNECTORS.length });
  }

  async stop(): Promise<void> {
    for (const [id, connector] of this.connectors) {
      if (connector.status === "connected") {
        await this.disconnect(id);
      }
    }
    this.connectors.clear();
    this.frameworks.clear();
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    const connected = Array.from(this.connectors.values()).filter((c) => c.status === "connected").length;
    return {
      ok: true,
      message: `Connectors: ${connected} connected, ${this.connectors.size} total`,
      timestamp: Date.now(),
    };
  }

  async registerFramework(id: string, framework: ConnectorFramework): Promise<void> {
    this.frameworks.set(id, framework);
    this.emit("framework-registered", id);
  }

  getMetadata(id: string): ConnectorMetadata | null {
    return this.metadata.get(id) ?? null;
  }

  getAllMetadata(): ConnectorMetadata[] {
    return Array.from(this.metadata.values());
  }

  getConnector(id: string): Connector | null {
    return this.connectors.get(id) ?? null;
  }

  getAllConnectors(): Connector[] {
    return Array.from(this.connectors.values());
  }

  async connect(id: string, config?: Record<string, unknown>): Promise<void> {
    const meta = this.metadata.get(id);
    if (!meta) throw new Error(`Unknown connector: ${id}`);

    const framework = this.frameworks.get(id);
    if (framework) {
      await framework.connect({
        authType: "none",
        settings: config,
      });
    }

    const connector: Connector = {
      id,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      version: meta.version,
      enabled: true,
      status: "connected",
      config: { authType: "none", settings: config },
      lastSyncAt: Date.now(),
      errorCount: 0,
    };

    this.connectors.set(id, connector);
    this.emit("connected", connector);
  }

  async disconnect(id: string): Promise<void> {
    const framework = this.frameworks.get(id);
    if (framework) {
      await framework.disconnect();
    }

    const connector = this.connectors.get(id);
    if (connector) {
      connector.status = "disconnected";
      connector.enabled = false;
      this.emit("disconnected", id);
    }
  }

  async sync(id: string): Promise<void> {
    const framework = this.frameworks.get(id);
    const connector = this.connectors.get(id);
    if (!framework || !connector) return;

    try {
      const result = await framework.sync();
      connector.lastSyncAt = Date.now();
      connector.errorCount = 0;
      this.emit("synced", { id, result });
    } catch (err) {
      connector.errorCount += 1;
      connector.lastError = (err as Error).message;
      this.emit("sync-error", { id, error: err });
    }
  }

  async execute(id: string, command: string, payload?: unknown): Promise<unknown> {
    const framework = this.frameworks.get(id);
    if (!framework) throw new Error(`Connector not registered: ${id}`);
    return framework.execute(command, payload);
  }
}
