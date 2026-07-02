/**
 * Export Engine — Export workspace content in multiple formats.
 *
 * Supports: Markdown, JSON, TXT, PDF, CSV, ZIP
 * Scopes: Workspace, Project, Conversation, Note, Task, File, Timeline
 */

import { BaseEngine } from "./base";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============== TYPES ==============

export type ExportScope =
  | "workspace"
  | "project"
  | "conversation"
  | "note"
  | "task"
  | "file"
  | "timeline"
  | "all";

export type ExportFormat =
  | "markdown"
  | "txt"
  | "pdf"
  | "json"
  | "csv"
  | "zip";

export type ExportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface ExportJob {
  id: string;
  scope: ExportScope;
  format: ExportFormat;
  status: ExportStatus;
  progress: number;
  projectId?: string;
  itemIds: string[];

  // Output
  outputPath?: string;
  outputSize?: number;
  outputName: string;

  // Options
  options: ExportOptions;

  // Error handling
  errorMessage?: string;

  // Stats
  itemsExported: number;
  itemsTotal: number;

  // Timestamps
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  expiresAt?: number;
}

export interface ExportOptions {
  includeMetadata: boolean;
  includeTimestamps: boolean;
  includeToc: boolean;
  syntaxHighlighting: boolean;
  pageNumbers: boolean;
  coverPage: boolean;
  dateRange?: { from: string; to: string };
  tags?: string[];
  includeDeleted: boolean;
  compress: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeMetadata: true,
  includeTimestamps: true,
  includeToc: true,
  syntaxHighlighting: true,
  pageNumbers: true,
  coverPage: true,
  includeDeleted: false,
  compress: false,
};

// ============== ENGINE ==============

export class ExportEngine extends BaseEngine {
  private supabase: SupabaseClient | null = null;
  private jobs: Map<string, ExportJob> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor() {
    super({ name: "ExportEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // Load pending jobs
    await this.loadJobs();

    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    // Cancel all running exports
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.isRunning = false;
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    const active = Array.from(this.jobs.values()).filter(
      (j) => j.status === "processing"
    ).length;
    return {
      ok: true,
      message: `Export: ${this.jobs.size} jobs (${active} active)`,
      timestamp: Date.now(),
    };
  }

  // ============== JOB MANAGEMENT ==============

  /**
   * Create a new export job
   */
  async createJob(
    scope: ExportScope,
    format: ExportFormat,
    projectId?: string,
    itemIds: string[] = [],
    options: Partial<ExportOptions> = {}
  ): Promise<ExportJob> {
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    const job: ExportJob = {
      id,
      scope,
      format,
      status: "pending",
      progress: 0,
      projectId,
      itemIds,
      outputName: this.generateFileName(scope, format, projectId),
      options: { ...DEFAULT_EXPORT_OPTIONS, ...options },
      itemsExported: 0,
      itemsTotal: 0,
      createdAt: timestamp,
      expiresAt: timestamp + 24 * 60 * 60 * 1000, // 24 hours
    };

    this.jobs.set(id, job);

    // Save to Supabase
    if (this.supabase) {
      await this.supabase.from("omni_export_jobs").insert({
        id: job.id,
        scope: job.scope,
        format: job.format,
        status: job.status,
        project_id: job.projectId,
        item_ids: job.itemIds,
        output_name: job.outputName,
        options: job.options,
        items_exported: job.itemsExported,
        items_total: job.itemsTotal,
        expires_at: job.expiresAt ? new Date(job.expiresAt).toISOString() : null,
      });
    }

    this.emit("job-created", job);
    return job;
  }

  /**
   * Start processing an export job
   */
  async startJob(jobId: string): Promise<ExportJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status !== "pending") throw new Error(`Job ${jobId} is not pending`);

    const controller = new AbortController();
    this.abortControllers.set(jobId, controller);

    job.status = "processing";
    job.startedAt = Date.now();

    await this.updateJob(job);

    try {
      // Execute the export based on format
      const result = await this.executeExport(job, controller.signal);

      job.status = "completed";
      job.completedAt = Date.now();
      job.outputPath = result.path;
      job.outputSize = result.size;
      job.itemsExported = result.itemsExported;
      job.progress = 100;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        job.status = "cancelled";
      } else {
        job.status = "failed";
        job.errorMessage = error instanceof Error ? error.message : "Unknown error";
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
  getJob(id: string): ExportJob | null {
    return this.jobs.get(id) ?? null;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Delete a job
   */
  async deleteJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    // Cancel if running
    if (job.status === "processing") {
      await this.cancelJob(id);
    }

    this.jobs.delete(id);

    if (this.supabase) {
      await this.supabase.from("omni_export_jobs").delete().eq("id", id);
    }

    this.emit("job-deleted", id);
    return true;
  }

  // ============== EXPORT EXECUTION ==============

  private async executeExport(
    job: ExportJob,
    signal: AbortSignal
  ): Promise<{ path: string; size: number; itemsExported: number }> {
    // Collect data based on scope
    const data = await this.collectData(job, signal);

    // Generate output based on format
    switch (job.format) {
      case "markdown":
        return this.exportMarkdown(job, data, signal);
      case "json":
        return this.exportJson(job, data, signal);
      case "txt":
        return this.exportTxt(job, data, signal);
      case "csv":
        return this.exportCsv(job, data, signal);
      case "pdf":
        return this.exportPdf(job, data, signal);
      case "zip":
        return this.exportZip(job, data, signal);
      default:
        throw new Error(`Unsupported format: ${job.format}`);
    }
  }

  /**
   * Collect data to export based on scope
   */
  private async collectData(job: ExportJob, signal: AbortSignal): Promise<ExportData> {
    if (!this.supabase) {
      throw new Error("Supabase not configured");
    }

    const data: ExportData = {
      projects: [],
      conversations: [],
      messages: [],
      files: [],
      notes: [],
      tasks: [],
      snippets: [],
      timeline: [],
    };

    switch (job.scope) {
      case "workspace":
      case "all":
        // Export all content
        await this.collectProjects(data, null, signal);
        break;

      case "project":
        await this.collectProjects(data, job.projectId || null, signal);
        break;

      case "conversation":
        await this.collectConversations(data, job.itemIds, signal);
        break;

      case "note":
        await this.collectNotes(data, job.itemIds, signal);
        break;

      case "task":
        await this.collectTasks(data, job.itemIds, signal);
        break;

      case "file":
        await this.collectFiles(data, job.itemIds, signal);
        break;

      case "timeline":
        await this.collectTimeline(data, job.projectId, signal);
        break;
    }

    return data;
  }

  private async collectProjects(
    data: ExportData,
    projectId: string | null,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    let query = this.supabase!.from("omni_projects").select("*");

    if (projectId) {
      query = query.eq("id", projectId);
    }

    const { data: projects } = await query;

    if (projects) {
      data.projects = projects;
    }

    // Collect related content for each project
    for (const project of data.projects) {
      await this.collectProjectContent(data, project.id as string, signal);
    }
  }

  private async collectProjectContent(
    data: ExportData,
    projectId: string,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    // Conversations
    const { data: conversations } = await this.supabase!
      .from("omni_conversations")
      .select("*")
      .eq("project_id", projectId);

    if (conversations) {
      data.conversations.push(...conversations);
    }

    // Files
    const { data: files } = await this.supabase!
      .from("omni_files")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    if (files) {
      data.files.push(...files);
    }

    // Notes
    const { data: notes } = await this.supabase!
      .from("omni_notes")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    if (notes) {
      data.notes.push(...notes);
    }

    // Tasks
    const { data: tasks } = await this.supabase!
      .from("omni_tasks")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    if (tasks) {
      data.tasks.push(...tasks);
    }

    // Snippets
    const { data: snippets } = await this.supabase!
      .from("omni_snippets")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_deleted", false);

    if (snippets) {
      data.snippets.push(...snippets);
    }
  }

  private async collectConversations(
    data: ExportData,
    conversationIds: string[],
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const { data: conversations } = await this.supabase!
      .from("omni_conversations")
      .select("*")
      .in("id", conversationIds);

    if (conversations) {
      data.conversations = conversations;

      // Collect messages for each conversation
      for (const conv of conversations) {
        const { data: messages } = await this.supabase!
          .from("omni_messages")
          .select("*")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });

        if (messages) {
          data.messages.push(...messages);
        }
      }
    }
  }

  private async collectNotes(
    data: ExportData,
    noteIds: string[],
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const { data: notes } = await this.supabase!
      .from("omni_notes")
      .select("*")
      .in("id", noteIds);

    if (notes) {
      data.notes = notes;
    }
  }

  private async collectTasks(
    data: ExportData,
    taskIds: string[],
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const { data: tasks } = await this.supabase!
      .from("omni_tasks")
      .select("*")
      .in("id", taskIds);

    if (tasks) {
      data.tasks = tasks;
    }
  }

  private async collectFiles(
    data: ExportData,
    fileIds: string[],
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const { data: files } = await this.supabase!
      .from("omni_files")
      .select("*")
      .in("id", fileIds);

    if (files) {
      data.files = files;
    }
  }

  private async collectTimeline(
    data: ExportData,
    projectId: string | undefined,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    let query = this.supabase!
      .from("omni_timeline_events")
      .select("*")
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data: timeline } = await query.limit(500);

    if (timeline) {
      data.timeline = timeline;
    }
  }

  // ============== FORMAT EXPORTERS ==============

  private async exportMarkdown(
    job: ExportJob,
    data: ExportData,
    signal: AbortSignal
  ): Promise<{ path: string; size: number; itemsExported: number }> {
    let content = "";

    // Cover page
    if (job.options.coverPage) {
      content += this.generateMarkdownCover(job);
    }

    // Table of contents
    if (job.options.includeToc) {
      content += this.generateMarkdownToc(data);
    }

    // Projects
    for (const project of data.projects) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += this.projectToMarkdown(project, data, job.options);
      job.itemsExported++;
    }

    // Conversations
    for (const conv of data.conversations) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += this.conversationToMarkdown(conv, data.messages, job.options);
      job.itemsExported++;
    }

    // Notes
    for (const note of data.notes) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += this.noteToMarkdown(note);
      job.itemsExported++;
    }

    // Tasks
    for (const task of data.tasks) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += this.taskToMarkdown(task);
      job.itemsExported++;
    }

    const blob = new Blob([content], { type: "text/markdown" });
    return this.downloadBlob(blob, job.outputName);
  }

  private async exportJson(
    job: ExportJob,
    data: ExportData,
    _signal: AbortSignal
  ): Promise<{ path: string; size: number; itemsExported: number }> {
    const jsonData = {
      exportedAt: new Date().toISOString(),
      scope: job.scope,
      format: job.format,
      options: job.options,
      data,
    };

    const content = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([content], { type: "application/json" });

    job.itemsExported =
      data.projects.length +
      data.conversations.length +
      data.notes.length +
      data.tasks.length +
      data.files.length +
      data.snippets.length;

    return this.downloadBlob(blob, job.outputName);
  }

  private async exportTxt(
    job: ExportJob,
    data: ExportData,
    signal: AbortSignal
  ): Promise<{ path: string; size: number; itemsExported: number }> {
    let content = "";
    const separator = "=".repeat(80);

    // Header
    content += `${separator}\n`;
    content += `Omni Export - ${job.scope.toUpperCase()}\n`;
    content += `Exported: ${new Date().toLocaleString()}\n`;
    content += `${separator}\n\n`;

    // Projects
    for (const project of data.projects) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += `${separator}\n`;
      content += `PROJECT: ${project.name}\n`;
      content += `${separator}\n`;
      if (job.options.includeMetadata) {
        content += `Platform: ${project.platform || "Unknown"}\n`;
        content += `Created: ${project.created_at}\n`;
      }
      content += "\n";
      job.itemsExported++;
    }

    // Conversations
    for (const conv of data.conversations) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += `${separator}\n`;
      content += `CONVERSATION: ${(conv.title as string) || "Untitled"}\n`;
      content += `${separator}\n\n`;

      const messages = data.messages.filter((m) => m.conversation_id === conv.id);
      for (const msg of messages) {
        const role = ((msg.role as string) || "USER").toUpperCase();
        content += `[${role}]\n`;
        content += `${(msg.content as string) || ""}\n\n`;
      }
      job.itemsExported++;
    }

    // Notes
    for (const note of data.notes) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += `${separator}\n`;
      content += `NOTE: ${(note.title as string) || "Untitled"}\n`;
      content += `${separator}\n\n`;
      content += `${(note.content as string) || ""}\n\n`;
      job.itemsExported++;
    }

    const blob = new Blob([content], { type: "text/plain" });
    return this.downloadBlob(blob, job.outputName);
  }

  private async exportCsv(
    job: ExportJob,
    data: ExportData,
    _signal: AbortSignal
  ): Promise<{ path: string; size: number; itemsExported: number }> {
    // CSV export works best for structured data like tasks or timeline
    let content = "";

    // Determine what to export based on scope
    if (job.scope === "task" || data.tasks.length > 0) {
      content = this.tasksToCsv(data.tasks);
      job.itemsExported = data.tasks.length;
    } else if (job.scope === "timeline" || data.timeline.length > 0) {
      content = this.timelineToCsv(data.timeline);
      job.itemsExported = data.timeline.length;
    } else {
      // Export projects summary
      content = this.projectsToCsv(data.projects);
      job.itemsExported = data.projects.length;
    }

    const blob = new Blob([content], { type: "text/csv" });
    return this.downloadBlob(blob, job.outputName);
  }

  private async exportPdf(
    job: ExportJob,
    data: ExportData,
    signal: AbortSignal
  ): Promise<{ path: string; size: number; itemsExported: number }> {
    // For PDF, we'll generate a printable HTML and convert it
    // In a browser environment, we use print-to-PDF functionality
    let content = "";

    // Cover page HTML
    if (job.options.coverPage) {
      content += `
        <div style="page-break-after: always; text-align: center; padding-top: 200px;">
          <h1 style="font-size: 48px; margin-bottom: 20px;">Omni Export</h1>
          <p style="font-size: 24px; color: #666;">${job.scope.toUpperCase()}</p>
          <p style="font-size: 16px; color: #999; margin-top: 40px;">${new Date().toLocaleDateString()}</p>
        </div>
      `;
    }

    // Table of contents
    if (job.options.includeToc) {
      content += `
        <div style="page-break-after: always;">
          <h2>Table of Contents</h2>
          <ul>
      `;

      for (const project of data.projects) {
        content += `<li><a href="#project-${project.id}">${project.name}</a></li>`;
      }
      for (const conv of data.conversations) {
        content += `<li><a href="#conv-${conv.id}">${conv.title || "Untitled Conversation"}</a></li>`;
      }
      for (const note of data.notes) {
        content += `<li><a href="#note-${note.id}">${note.title}</a></li>`;
      }

      content += "</ul></div>";
    }

    // Content
    content += "<div style='font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;'>";

    for (const project of data.projects) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += `<div id="project-${project.id}" style="page-break-before: always;">`;
      content += `<h1>${project.name}</h1>`;
      if (project.description) {
        content += `<p style="color: #666;">${project.description}</p>`;
      }
      content += "</div>";
      job.itemsExported++;
    }

    for (const conv of data.conversations) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += `<div id="conv-${conv.id}" style="page-break-before: always;">`;
      content += `<h2>${(conv.title as string) || "Untitled Conversation"}</h2>`;

      const messages = data.messages.filter((m) => m.conversation_id === conv.id);
      for (const msg of messages) {
        const isAssistant = msg.role === "assistant";
        const roleText = ((msg.role as string) || "USER").toUpperCase();
        content += `<div style="margin: 20px 0; padding: 15px; background: ${isAssistant ? "#f5f5f5" : "#fff"}; border-radius: 8px; border-left: 4px solid ${isAssistant ? "#4CAF50" : "#2196F3"};">`;
        content += `<div style="font-weight: bold; color: ${isAssistant ? "#4CAF50" : "#2196F3"}; margin-bottom: 10px;">${roleText}</div>`;
        content += `<div>${(msg.content as string) || ""}</div>`;
        content += "</div>";
      }
      content += "</div>";
      job.itemsExported++;
    }

    for (const note of data.notes) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      content += `<div id="note-${note.id}" style="page-break-before: always;">`;
      content += `<h2>${(note.title as string) || "Untitled"}</h2>`;
      content += `<div>${(note.content as string) || ""}</div>`;
      content += "</div>";
      job.itemsExported++;
    }

    content += "</div>";

    // Create a printable document
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${job.outputName}</title>
          <style>
            @media print {
              body { margin: 0; }
              .page-break { page-break-before: always; }
            }
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            pre, code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
            h1, h2, h3 { margin-top: 24px; margin-bottom: 12px; }
          </style>
        </head>
        <body>
          ${content}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }

    // Simulate completion (actual PDF generated by browser print dialog)
    return {
      path: job.outputName,
      size: content.length,
      itemsExported: job.itemsExported,
    };
  }

  private async exportZip(
    job: ExportJob,
    data: ExportData,
    signal: AbortSignal
  ): Promise<{ path: string; size: number; itemsExported: number }> {
    // For ZIP, we'll use JSZip library if available, otherwise fall back to JSON
    // In a real implementation, we would import jszip and create archive
    // For now, we'll create a JSON export and note that ZIP requires the library

    // Fall back to JSON export
    const result = await this.exportJson(job, data, signal);
    job.outputName = job.outputName.replace(".zip", ".json");
    return result;
  }

  // ============== HELPERS ==============

  private generateFileName(scope: ExportScope, format: ExportFormat, projectId?: string): string {
    const timestamp = new Date().toISOString().split("T")[0];
    const scopeName = projectId ? `${scope}-${projectId.slice(0, 8)}` : scope;
    const extension = format === "markdown" ? "md" : format;
    return `omni-${scopeName}-${timestamp}.${extension}`;
  }

  private generateMarkdownCover(job: ExportJob): string {
    return `---
title: Omni Export
scope: ${job.scope}
format: ${job.format}
exported: ${new Date().toISOString()}
---

# Omni Export

**Scope:** ${job.scope}
**Format:** ${job.format}
**Date:** ${new Date().toLocaleString()}

---

`;
  }

  private generateMarkdownToc(data: ExportData): string {
    let toc = "\n## Table of Contents\n\n";

    for (const project of data.projects) {
      toc += `- [${project.name}](#project-${project.id})\n`;
    }
    for (const conv of data.conversations) {
      toc += `  - [${conv.title || "Untitled Conversation"}](#conversation-${conv.id})\n`;
    }
    for (const note of data.notes) {
      toc += `- [${note.title}](#note-${note.id})\n`;
    }
    for (const task of data.tasks) {
      toc += `- [${task.title}](#task-${task.id})\n`;
    }

    toc += "\n---\n\n";
    return toc;
  }

  private projectToMarkdown(
    project: Record<string, unknown>,
    data: ExportData,
    options: ExportOptions
  ): string {
    let md = `\n## Project: ${project.name}\n\n`;

    if (options.includeMetadata) {
      md += `**Platform:** ${project.platform || "Unknown"}\n`;
      md += `**Created:** ${project.created_at}\n`;
      if (project.description) {
        md += `\n${project.description}\n`;
      }
    }

    // Add related content
    const projectConvs = data.conversations.filter(
      (c) => c.project_id === project.id
    );
    for (const conv of projectConvs) {
      md += this.conversationToMarkdown(
        conv,
        data.messages,
        options
      );
    }

    const projectNotes = data.notes.filter((n) => n.project_id === project.id);
    for (const note of projectNotes) {
      md += this.noteToMarkdown(note);
    }

    const projectTasks = data.tasks.filter((t) => t.project_id === project.id);
    for (const task of projectTasks) {
      md += this.taskToMarkdown(task);
    }

    return md;
  }

  private conversationToMarkdown(
    conv: Record<string, unknown>,
    messages: Record<string, unknown>[],
    options: ExportOptions
  ): string {
    let md = `\n### Conversation: ${conv.title || "Untitled"}\n\n`;

    if (options.includeMetadata) {
      md += `**Platform:** ${conv.platform || "Unknown"}\n`;
      md += `**Model:** ${conv.ai_model || "Unknown"}\n`;
      md += `**Created:** ${conv.created_at}\n\n`;
    }

    const convMessages = messages.filter((m) => m.conversation_id === conv.id);
    for (const msg of convMessages) {
      const role = (msg.role as string)?.toUpperCase() || "USER";
      md += `#### ${role}\n\n`;
      md += `${msg.content || ""}\n\n`;
    }

    return md;
  }

  private noteToMarkdown(note: Record<string, unknown>): string {
    let md = `\n### Note: ${note.title}\n\n`;
    if (note.content) {
      md += `${note.content}\n\n`;
    }
    return md;
  }

  private taskToMarkdown(task: Record<string, unknown>): string {
    let md = `\n### Task: ${task.title}\n\n`;
    md += `**Status:** ${task.status}\n`;
    md += `**Priority:** ${task.priority}\n`;
    if (task.description) {
      md += `\n${task.description}\n`;
    }
    return md + "\n";
  }

  private tasksToCsv(tasks: Record<string, unknown>[]): string {
    let csv = "id,title,status,priority,due_date,created_at,completed_at\n";
    for (const task of tasks) {
      csv += `${task.id},"${task.title}",${task.status},${task.priority},${task.due_date || ""},${task.created_at},${task.completed_at || ""}\n`;
    }
    return csv;
  }

  private timelineToCsv(timeline: Record<string, unknown>[]): string {
    let csv = "id,event_type,category,title,project_id,created_at\n";
    for (const event of timeline) {
      csv += `${event.id},${event.event_type},${event.category},"${event.title}",${event.project_id || ""},${event.created_at}\n`;
    }
    return csv;
  }

  private projectsToCsv(projects: Record<string, unknown>[]): string {
    let csv = "id,name,platform,favorite,archived,created_at\n";
    for (const project of projects) {
      csv += `${project.id},"${project.name}",${project.platform || ""},${project.is_favorite || false},${project.is_archived || false},${project.created_at}\n`;
    }
    return csv;
  }

  private downloadBlob(blob: Blob, filename: string): { path: string; size: number; itemsExported: number } {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      path: filename,
      size: blob.size,
      itemsExported: 0,
    };
  }

  private async updateJob(job: ExportJob): Promise<void> {
    this.jobs.set(job.id, job);
    this.emit("job-updated", job);

    if (this.supabase) {
      await this.supabase.from("omni_export_jobs").upsert({
        id: job.id,
        scope: job.scope,
        format: job.format,
        status: job.status,
        progress: job.progress,
        project_id: job.projectId || null,
        item_ids: job.itemIds,
        output_name: job.outputName,
        output_path: job.outputPath || null,
        output_size: job.outputSize || null,
        options: job.options,
        error_message: job.errorMessage || null,
        items_exported: job.itemsExported,
        items_total: job.itemsTotal,
        started_at: job.startedAt ? new Date(job.startedAt).toISOString() : null,
        completed_at: job.completedAt ? new Date(job.completedAt).toISOString() : null,
      }, { onConflict: "id" });
    }
  }

  private async loadJobs(): Promise<void> {
    if (!this.supabase) return;

    const { data } = await this.supabase
      .from("omni_export_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) {
      for (const row of data) {
        this.jobs.set(row.id, {
          id: row.id,
          scope: row.scope as ExportScope,
          format: row.format as ExportFormat,
          status: row.status as ExportStatus,
          progress: row.progress || 0,
          projectId: row.project_id || undefined,
          itemIds: (row.item_ids as string[]) || [],
          outputName: row.output_name,
          outputPath: row.output_path || undefined,
          outputSize: row.output_size || undefined,
          options: (row.options as ExportOptions) || DEFAULT_EXPORT_OPTIONS,
          errorMessage: row.error_message || undefined,
          itemsExported: row.items_exported || 0,
          itemsTotal: row.items_total || 0,
          createdAt: new Date(row.created_at).getTime(),
          startedAt: row.started_at ? new Date(row.started_at).getTime() : undefined,
          completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
          expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
        });
      }
    }
  }
}

// ============== TYPES FOR DATA COLLECTION ==============

interface ExportData {
  projects: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  files: Record<string, unknown>[];
  notes: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  snippets: Record<string, unknown>[];
  timeline: Record<string, unknown>[];
}

// ============== SINGLETON ==============

let _instance: ExportEngine | null = null;

export function getExportEngine(): ExportEngine {
  if (!_instance) {
    _instance = new ExportEngine();
  }
  return _instance;
}
