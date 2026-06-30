import type { UUID, Timestamp } from "../types/omni";

/**
 * Export — Architecture for the future Export Engine.
 */

export interface ExportJob {
  id: UUID;
  type: ExportType;
  format: ExportFormat;
  status: "pending" | "processing" | "completed" | "failed";
  projectId: UUID | null;
  conversationIds: UUID[];
  fileName: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  error?: string;
  downloadUrl?: string;
}

export type ExportType = "conversation" | "project" | "workspace" | "selection";

export type ExportFormat = "markdown" | "json" | "txt" | "pdf" | "csv";

export interface ExportConfig {
  format: ExportFormat;
  includeMetadata: boolean;
  includeTimestamps: boolean;
  includePlatformInfo: boolean;
  compress: boolean;
  password?: string;
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  format: "markdown",
  includeMetadata: true,
  includeTimestamps: true,
  includePlatformInfo: true,
  compress: false,
};
