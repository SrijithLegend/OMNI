import type { UUID, Timestamp } from "../types/omni";

/**
 * Connector — Third-party integration abstraction.
 *
 * Every connector implements a standard lifecycle for linking
 * external services like GitHub, Notion, Google Drive, etc.
 */

export interface Connector {
  id: string; // e.g. "github", "notion", "google-drive"
  name: string;
  description: string;
  icon: string;
  version: string;
  enabled: boolean;
  status: "disconnected" | "connecting" | "connected" | "error";
  config: ConnectorConfig;
  lastSyncAt?: Timestamp;
  errorCount: number;
  lastError?: string;
}

export interface ConnectorConfig {
  authType: "oauth" | "api-key" | "pat" | "none";
  credentials?: Record<string, string>;
  scopes?: string[];
  baseUrl?: string;
  settings?: Record<string, unknown>;
}

export interface ConnectorMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "development" | "productivity" | "communication" | "storage";
  available: boolean;
  requiresAuth: boolean;
  permissions: string[];
}

export interface ConnectorSyncResult {
  success: boolean;
  itemsSynced: number;
  errors: string[];
  timestamp: Timestamp;
}

export interface ConnectorFramework {
  metadata: ConnectorMetadata;
  connect(config: ConnectorConfig): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<{ ok: boolean; message: string }>;
  sync(options?: Record<string, unknown>): Promise<ConnectorSyncResult>;
  execute(command: string, payload?: unknown): Promise<unknown>;
}

export const BUILT_IN_CONNECTORS: ConnectorMetadata[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Sync repos, issues, and PRs",
    icon: "github",
    category: "development",
    available: true,
    requiresAuth: true,
    permissions: ["repo", "read:user"],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Sync pages and databases",
    icon: "file-text",
    category: "productivity",
    available: true,
    requiresAuth: true,
    permissions: ["read_content"],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Access files and folders",
    icon: "hard-drive",
    category: "storage",
    available: true,
    requiresAuth: true,
    permissions: ["drive.readonly"],
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Read and draft emails",
    icon: "mail",
    category: "communication",
    available: true,
    requiresAuth: true,
    permissions: ["gmail.readonly"],
  },
  {
    id: "google-docs",
    name: "Google Docs",
    description: "Edit documents",
    icon: "file-text",
    category: "productivity",
    available: true,
    requiresAuth: true,
    permissions: ["documents.readonly"],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Access spreadsheets",
    icon: "table",
    category: "productivity",
    available: true,
    requiresAuth: true,
    permissions: ["spreadsheets.readonly"],
  },
];
