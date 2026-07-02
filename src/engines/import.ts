/**
 * Import Engine — Import content from external files.
 *
 * Supports: Markdown, JSON, TXT, CSV with validation
 */

import { BaseEngine } from "./base";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============== TYPES ==============

export type ImportFormat = "markdown" | "json" | "txt" | "csv";
export type ImportTarget = "project" | "conversation" | "note" | "task" | "snippet";
export type ImportStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface ImportJob {
  id: string;
  format: ImportFormat;
  target: ImportTarget;
  status: ImportStatus;
  progress: number;
  projectId?: string;

  // File info
  fileName: string;
  fileSize: number;
  fileContent?: string;

  // Options
  options: ImportOptions;

  // Results
  itemsImported: number;
  itemsTotal: number;
  itemsSkipped: number;
  errors: ImportError[];

  // Timestamps
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface ImportOptions {
  mode: "create" | "merge" | "replace";
  validateOnly: boolean;
  skipErrors: boolean;
  detectLanguage: boolean;
  autoTag: boolean;
  defaultTags?: string[];
  defaultProjectId?: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface ImportPreview {
  valid: boolean;
  items: ImportPreviewItem[];
  errors: ImportError[];
  warnings: string[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
}

export interface ImportPreviewItem {
  index: number;
  type: ImportTarget;
  data: Record<string, unknown>;
  valid: boolean;
  errors: Array<{ field: string; message: string; value?: unknown }>;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  mode: "create",
  validateOnly: false,
  skipErrors: true,
  detectLanguage: true,
  autoTag: false,
};

// ============== ENGINE ==============

export class ImportEngine extends BaseEngine {
  private supabase: SupabaseClient | null = null;
  private jobs: Map<string, ImportJob> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor() {
    super({ name: "ImportEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.isRunning = false;
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    return {
      ok: true,
      message: `Import: ${this.jobs.size} jobs`,
      timestamp: Date.now(),
    };
  }

  // ============== FILE VALIDATION ==============

  /**
   * Validate a file before import
   */
  async validateFile(file: File): Promise<{ valid: boolean; format: ImportFormat | null; error?: string }> {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, format: null, error: "File size exceeds 10MB limit" };
    }

    // Detect format from extension
    const extension = file.name.split(".").pop()?.toLowerCase();
    const format = this.detectFormat(extension);

    if (!format) {
      return { valid: false, format: null, error: `Unsupported file format: ${extension}` };
    }

    return { valid: true, format };
  }

  /**
   * Preview import contents without committing
   */
  async preview(
    file: File,
    target: ImportTarget,
    options: Partial<ImportOptions> = {}
  ): Promise<ImportPreview> {
    const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options };
    const preview: ImportPreview = {
      valid: false,
      items: [],
      errors: [],
      warnings: [],
      stats: { total: 0, valid: 0, invalid: 0, duplicates: 0 },
    };

    try {
      const content = await this.readFileContent(file);
      const format = await this.detectFormat(file.name.split(".").pop()?.toLowerCase());

      if (!format) {
        preview.errors.push({ row: 0, field: "format", message: "Could not detect file format" });
        return preview;
      }

      // Parse based on format
      const parsed = await this.parseContent(content, format, target);
      preview.stats.total = parsed.length;

      // Validate each item
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        const validation = this.validateItem(item, target);

        preview.items.push({
          index: i,
          type: target,
          data: item,
          valid: validation.valid,
          errors: validation.errors,
        });

        if (validation.valid) {
          preview.stats.valid++;
        } else {
          preview.stats.invalid++;
          preview.errors.push(
            ...validation.errors.map((e) => ({
              row: i,
              field: e.field,
              message: e.message,
              value: e.value,
            }))
          );
        }
      }

      preview.valid = preview.stats.invalid === 0;
    } catch (error) {
      preview.errors.push({
        row: 0,
        field: "file",
        message: error instanceof Error ? error.message : "Unknown error parsing file",
      });
    }

    return preview;
  }

  // ============== IMPORT EXECUTION ==============

  /**
   * Create an import job
   */
  async createJob(
    file: File,
    target: ImportTarget,
    projectId?: string,
    options: Partial<ImportOptions> = {}
  ): Promise<ImportJob> {
    const id = crypto.randomUUID();
    const content = await this.readFileContent(file);
    const format = this.detectFormat(file.name.split(".").pop()?.toLowerCase()) || "txt";

    const job: ImportJob = {
      id,
      format,
      target,
      status: "pending",
      progress: 0,
      projectId,
      fileName: file.name,
      fileSize: file.size,
      fileContent: content,
      options: { ...DEFAULT_IMPORT_OPTIONS, ...options },
      itemsImported: 0,
      itemsTotal: 0,
      itemsSkipped: 0,
      errors: [],
      createdAt: Date.now(),
    };

    this.jobs.set(id, job);
    this.emit("job-created", job);

    return job;
  }

  /**
   * Start processing an import job
   */
  async startJob(jobId: string): Promise<ImportJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status !== "pending") throw new Error(`Job ${jobId} is not pending`);
    if (!job.fileContent) throw new Error(`Job ${jobId} has no file content`);

    const controller = new AbortController();
    this.abortControllers.set(jobId, controller);

    job.status = "processing";
    job.startedAt = Date.now();

    await this.updateJob(job);

    try {
      // Parse file content
      const parsed = await this.parseContent(job.fileContent, job.format, job.target);
      job.itemsTotal = parsed.length;

      // Import each item
      for (let i = 0; i < parsed.length; i++) {
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const item = parsed[i];
        const validation = this.validateItem(item, job.target);

        if (!validation.valid) {
          if (job.options.skipErrors) {
            job.itemsSkipped++;
            job.errors.push(
              ...validation.errors.map((e) => ({
                row: i,
                field: e.field,
                message: e.message,
                value: e.value,
              }))
            );
          } else {
            throw new Error(`Row ${i} validation failed: ${validation.errors.map((e) => e.message).join(", ")}`);
          }
        } else {
          // Import the item
          try {
            await this.importItem(item, job.target, job);
            job.itemsImported++;
          } catch (error) {
            if (job.options.skipErrors) {
              job.itemsSkipped++;
              job.errors.push({
                row: i,
                field: "import",
                message: error instanceof Error ? error.message : "Import failed",
              });
            } else {
              throw error;
            }
          }
        }

        job.progress = Math.round(((i + 1) / parsed.length) * 100);
        await this.updateJob(job);
      }

      job.status = "completed";
      job.completedAt = Date.now();
      job.progress = 100;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        job.status = "cancelled";
      } else {
        job.status = "failed";
        job.errors.push({
          row: 0,
          field: "import",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    await this.updateJob(job);
    this.abortControllers.delete(jobId);

    return job;
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    const controller = this.abortControllers.get(jobId);
    if (controller) {
      controller.abort();
    }

    const job = this.jobs.get(jobId);
    if (job && job.status === "processing") {
      job.status = "cancelled";
      await this.updateJob(job);
    }
  }

  /**
   * Get a job by ID
   */
  getJob(id: string): ImportJob | null {
    return this.jobs.get(id) ?? null;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ImportJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Delete a job
   */
  async deleteJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (job.status === "processing") {
      await this.cancelJob(id);
    }

    this.jobs.delete(id);
    this.emit("job-deleted", id);
    return true;
  }

  // ============== INTERNAL ==============

  private detectFormat(extension?: string): ImportFormat | null {
    switch (extension?.toLowerCase()) {
      case "md":
      case "markdown":
        return "markdown";
      case "json":
        return "json";
      case "txt":
        return "txt";
      case "csv":
        return "csv";
      default:
        return null;
    }
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  private async parseContent(
    content: string,
    format: ImportFormat,
    target: ImportTarget
  ): Promise<Record<string, unknown>[]> {
    switch (format) {
      case "json":
        return this.parseJson(content, target);
      case "markdown":
        return this.parseMarkdown(content, target);
      case "csv":
        return this.parseCsv(content, target);
      case "txt":
        return this.parseTxt(content, target);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private parseJson(content: string, _target: ImportTarget): Record<string, unknown>[] {
    const data = JSON.parse(content);

    // Handle array or single object
    if (Array.isArray(data)) {
      return data;
    }

    // Handle wrapped data (e.g., { projects: [...] })
    const wrapperKey = `${_target}s`;
    if (data[wrapperKey] && Array.isArray(data[wrapperKey])) {
      return data[wrapperKey];
    }

    // Single object
    return [data];
  }

  private parseMarkdown(content: string, target: ImportTarget): Record<string, unknown>[] {
    const items: Record<string, unknown>[] = [];

    // Split by headers
    const sections = content.split(/^(#{1,3})\s+(.+)$/m);

    let currentTitle = "";
    let currentContent = "";
    let level = 0;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      if (!section) continue;

      // Check if this is a header marker
      if (/^#{1,3}$/.test(section)) {
        // Save previous section
        if (currentTitle && currentContent) {
          items.push(this.contentToItem(currentTitle, currentContent, target));
        }
        level = section.length;
        currentTitle = sections[i + 1]?.trim() || "";
        currentContent = "";
        i++; // Skip title
      } else {
        currentContent += section + "\n";
      }
    }

    // Don't forget the last section
    if (currentTitle && currentContent) {
      items.push(this.contentToItem(currentTitle, currentContent, target));
    } else if (currentContent && items.length === 0) {
      // No headers, treat entire content as one item
      items.push(this.contentToItem("Imported Note", currentContent, target));
    }

    return items;
  }

  private parseCsv(content: string, _target: ImportTarget): Record<string, unknown>[] {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return [];

    // Parse header
    const headers = this.parseCsvLine(lines[0]);
    const items: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const item: Record<string, unknown> = {};

      for (let j = 0; j < headers.length; j++) {
        item[headers[j]] = values[j] || "";
      }

      items.push(item);
    }

    return items;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private parseTxt(content: string, target: ImportTarget): Record<string, unknown>[] {
    // Split by double newlines or "-----" separators
    const sections = content.split(/\n\s*\n|\n--+|\n\n/);
    const items: Record<string, unknown>[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      if (!section) continue;

      // Try to extract title from first line
      const lines = section.split("\n");
      const title = lines[0].trim() || `Item ${i + 1}`;
      const body = lines.slice(1).join("\n").trim();

      items.push(this.contentToItem(title, body || section, target));
    }

    return items;
  }

  private contentToItem(title: string, content: string, target: ImportTarget): Record<string, unknown> {
    switch (target) {
      case "note":
        return { title, content };
      case "task":
        return {
          title,
          description: content,
          status: "todo",
          priority: "medium",
        };
      case "snippet":
        return { title, code: content, language: this.detectCodeLanguage(content) };
      case "conversation":
        return { title, messages: [{ role: "user", content }] };
      default:
        return { title, content };
    }
  }

  private detectCodeLanguage(code: string): string {
    // Simple language detection from code patterns
    if (/^\s*(function|const|let|var)\s+\w+/.test(code)) return "javascript";
    if (/^\s*def\s+\w+|^\s*class\s+\w+|^\s*import\s+\w+/.test(code)) return "python";
    if (/^\s*package\s+\w+/.test(code)) return "go";
    if (/^\s*func\s+\w+/.test(code)) return "go";
    if (/^\s*fn\s+\w+/.test(code)) return "rust";
    if (/^\s*SELECT\s+|^\s*INSERT\s+/i.test(code)) return "sql";
    if (/^\s*<\w+[^>]*>/.test(code)) return "html";
    if (/^\s*\{\s*"[\w]+"\s*:/.test(code)) return "json";
    return "text";
  }

  private validateItem(
    item: Record<string, unknown>,
    target: ImportTarget
  ): { valid: boolean; errors: Array<{ field: string; message: string; value?: unknown }> } {
    const errors: Array<{ field: string; message: string; value?: unknown }> = [];

    switch (target) {
      case "note":
        if (!item.title || typeof item.title !== "string") {
          errors.push({ field: "title", message: "Title is required", value: item.title });
        }
        if (item.content !== undefined && typeof item.content !== "string") {
          errors.push({ field: "content", message: "Content must be a string", value: item.content });
        }
        break;

      case "task":
        if (!item.title || typeof item.title !== "string") {
          errors.push({ field: "title", message: "Title is required", value: item.title });
        }
        if (item.status && !["todo", "in_progress", "review", "done", "archived"].includes(item.status as string)) {
          errors.push({ field: "status", message: "Invalid status", value: item.status });
        }
        if (item.priority && !["low", "medium", "high", "urgent"].includes(item.priority as string)) {
          errors.push({ field: "priority", message: "Invalid priority", value: item.priority });
        }
        break;

      case "snippet":
        if (!item.title || typeof item.title !== "string") {
          errors.push({ field: "title", message: "Title is required", value: item.title });
        }
        if (item.code !== undefined && typeof item.code !== "string") {
          errors.push({ field: "code", message: "Code must be a string", value: item.code });
        }
        break;

      case "conversation":
        if (!item.title || typeof item.title !== "string") {
          errors.push({ field: "title", message: "Title is required", value: item.title });
        }
        break;

      case "project":
        if (!item.name && !item.title) {
          errors.push({ field: "name", message: "Project name is required" });
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  private async importItem(
    item: Record<string, unknown>,
    target: ImportTarget,
    job: ImportJob
  ): Promise<void> {
    if (!this.supabase) {
      throw new Error("Supabase not configured");
    }

    const projectId = job.projectId || job.options.defaultProjectId;
    const now = new Date().toISOString();

    // Apply auto-tagging
    if (job.options.autoTag && job.options.defaultTags) {
      item.tags = [...(item.tags as string[] || []), ...job.options.defaultTags];
    }

    switch (target) {
      case "note": {
        const { error } = await this.supabase.from("omni_notes").insert({
          id: crypto.randomUUID(),
          project_id: projectId,
          title: item.title as string,
          content: (item.content as string) || "",
          tags: (item.tags as string[]) || [],
          created_at: now,
          updated_at: now,
        });
        if (error) throw error;
        break;
      }

      case "task": {
        const { error } = await this.supabase.from("omni_tasks").insert({
          id: crypto.randomUUID(),
          project_id: projectId,
          title: item.title as string,
          description: (item.description as string) || "",
          status: (item.status as string) || "todo",
          priority: (item.priority as string) || "medium",
          tags: (item.tags as string[]) || [],
          created_at: now,
          updated_at: now,
        });
        if (error) throw error;
        break;
      }

      case "snippet": {
        const { error } = await this.supabase.from("omni_snippets").insert({
          id: crypto.randomUUID(),
          project_id: projectId,
          title: item.title as string,
          code: (item.code as string) || "",
          language: (item.language as string) || "text",
          type: (item.type as string) || "code",
          tags: (item.tags as string[]) || [],
          created_at: now,
          updated_at: now,
        });
        if (error) throw error;
        break;
      }

      case "project": {
        const { error } = await this.supabase.from("omni_projects").insert({
          id: crypto.randomUUID(),
          name: (item.name as string) || (item.title as string),
          description: (item.description as string) || "",
          platform: (item.platform as string) || "unknown",
          created_at: now,
          updated_at: now,
        });
        if (error) throw error;
        break;
      }

      default:
        throw new Error(`Unsupported import target: ${target}`);
    }
  }

  private async updateJob(job: ImportJob): Promise<void> {
    this.jobs.set(job.id, job);
    this.emit("job-updated", job);
  }
}

// ============== SINGLETON ==============

let _instance: ImportEngine | null = null;

export function getImportEngine(): ImportEngine {
  if (!_instance) {
    _instance = new ImportEngine();
  }
  return _instance;
}
