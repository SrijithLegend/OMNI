/**
 * Workspace Models — Types for File Library, Notes, Tasks, Snippets, Clipboard, Pinned, Activity
 */

import type { UUID, Timestamp } from "@/types/omni";

// ============== FILE LIBRARY ==============

export type FileExtension =
  | "pdf" | "docx" | "doc" | "txt" | "md" | "csv" | "json" | "xml" | "yaml" | "yml"
  | "png" | "jpg" | "jpeg" | "gif" | "svg" | "webp" | "ico"
  | "zip" | "tar" | "gz" | "rar" | "7z"
  | "py" | "js" | "ts" | "jsx" | "tsx" | "go" | "rs" | "java" | "cs" | "cpp" | "c" | "h"
  | "html" | "css" | "scss" | "sass" | "less" | "sql" | "sh" | "bash" | "zsh"
  | "vue" | "svelte" | "astro" | "php" | "rb" | "swift" | "kt" | "scala" | "ex" | "exs"
  | "dart" | "lua" | "r" | "m" | "mm";

export type StorageType = "local" | "indexeddb" | "cloud";

export interface WorkspaceFile {
  id: UUID;
  projectId: UUID;

  // File info
  name: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number; // bytes

  // Storage
  storagePath: string;
  storageType: StorageType;
  storageData?: string; // Base64 for small files, or blob reference

  // Organization
  folderId: UUID | null;
  tags: string[];

  // State
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  // Metadata
  description: string | null;
  previewText: string | null;
  thumbnailUrl: string | null;

  // Stats
  viewCount: number;
  downloadCount: number;
  lastOpenedAt: Timestamp | null;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface Folder {
  id: UUID;
  projectId: UUID;
  parentId: UUID | null;

  name: string;
  path: string; // e.g., /documents/work/
  color: string | null;
  icon: string | null;

  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============== MARKDOWN NOTES ==============

export interface Note {
  id: UUID;
  projectId: UUID;

  // Content
  title: string;
  content: string;

  // Organization
  folderId: UUID | null;
  tags: string[];

  // State
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  isArchived: boolean;

  // Stats
  wordCount: number;
  charCount: number;
  readingTime: number; // minutes

  // Version tracking
  version: number;
  lastAutoSavedAt: Timestamp | null;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface NoteVersion {
  id: UUID;
  noteId: UUID;

  content: string;
  wordCount: number;
  version: number;

  createdAt: Timestamp;
}

// ============== TASK MANAGER ==============

export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "archived";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: UUID;
  projectId: UUID;

  // Content
  title: string;
  description: string;

  // Status
  status: TaskStatus;
  priority: TaskPriority;

  // Organization
  folderId: UUID | null;
  tags: string[];

  // Progress
  progress: number; // 0-100

  // Dates
  dueDate: string | null; // YYYY-MM-DD
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;

  // Ordering
  position: number;

  // State
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface TaskDependency {
  id: UUID;
  taskId: UUID;
  dependsOnId: UUID;

  createdAt: Timestamp;
}

// ============== SNIPPET LIBRARY ==============

export type SnippetType = "code" | "prompt" | "template" | "command" | "markdown" | "json" | "shell" | "sql";

export interface Snippet {
  id: UUID;
  projectId: UUID;

  // Content
  title: string;
  code: string;
  language: string;

  // Type categorization
  type: SnippetType;

  // Organization
  folderId: UUID | null;
  tags: string[];

  // Usage
  useCount: number;
  lastUsedAt: Timestamp | null;

  // State
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

// ============== CLIPBOARD HISTORY ==============

export type ClipboardContentType = "text" | "code" | "link" | "path" | "command" | "prompt";

export interface ClipboardItem {
  id: UUID;
  projectId: UUID | null; // null for global clipboard

  // Content
  content: string;
  contentType: ClipboardContentType;

  // Detection
  detectedLanguage: string | null;
  sourceUrl: string | null;
  sourceApp: string | null;

  // Size
  charCount: number;
  lineCount: number;

  // State
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;

  // Privacy
  isSensitive: boolean;

  // Usage
  copyCount: number;
  lastCopiedAt: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  deletedAt: Timestamp | null;
  expiresAt: Timestamp | null;
}

// ============== PINNED ITEMS ==============

export type PinnedItemType = "file" | "note" | "task" | "snippet" | "clipboard" | "message" | "project";

export interface PinnedItem {
  id: UUID;
  projectId: UUID;

  // Polymorphic reference
  itemType: PinnedItemType;
  itemId: UUID;

  // Ordering
  position: number;

  // Timestamps
  createdAt: Timestamp;
}

// ============== RECENT ACTIVITY ==============

export type ActivityAction =
  | "created" | "updated" | "deleted" | "viewed" | "downloaded"
  | "completed" | "favorited" | "unfavorited" | "pinned" | "unpinned"
  | "restored" | "archived" | "moved";

export type ActivityItemType = "file" | "note" | "task" | "snippet" | "clipboard" | "message" | "project";

export interface ActivityItem {
  id: UUID;
  projectId: UUID;

  // Activity info
  action: ActivityAction;
  itemType: ActivityItemType;
  itemId: UUID | null;

  // Details
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown>;

  // Actor
  actorType: "user" | "system" | "sync";
  actorId: UUID | null;

  // Timestamp
  createdAt: Timestamp;
}

// ============== STORAGE USAGE ==============

export interface StorageUsage {
  id: UUID;
  projectId: UUID;

  // Usage stats
  filesSize: number;
  notesSize: number;
  clipboardSize: number;
  otherSize: number;
  totalSize: number;

  // File counts
  fileCount: number;
  noteCount: number;
  taskCount: number;
  snippetCount: number;
  clipboardCount: number;

  // Last calculated
  calculatedAt: Timestamp;
}

// ============== VIEW/TAB TYPES ==============

export type TaskViewMode = "list" | "kanban";

export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  archived: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
}

export interface FileFilter {
  extension?: string[];
  folderId?: UUID | null;
  tags?: string[];
  isFavorite?: boolean;
  isDeleted?: boolean;
  includeDeleted?: boolean;
  search?: string;
  sortBy?: "name" | "size" | "createdAt" | "updatedAt" | "lastOpenedAt";
  sortOrder?: "asc" | "desc";
}

export interface NoteFilter {
  folderId?: UUID | null;
  tags?: string[];
  isFavorite?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  search?: string;
  sortBy?: "title" | "createdAt" | "updatedAt" | "wordCount";
  sortOrder?: "asc" | "desc";
}

export interface TaskFilter {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  folderId?: UUID | null;
  tags?: string[];
  isFavorite?: boolean;
  isDeleted?: boolean;
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  sortBy?: "title" | "createdAt" | "updatedAt" | "dueDate" | "priority" | "position";
  sortOrder?: "asc" | "desc";
}

export interface SnippetFilter {
  type?: SnippetType[];
  language?: string[];
  folderId?: UUID | null;
  tags?: string[];
  isFavorite?: boolean;
  isDeleted?: boolean;
  search?: string;
  sortBy?: "title" | "createdAt" | "updatedAt" | "useCount" | "lastUsedAt";
  sortOrder?: "asc" | "desc";
}

export interface ClipboardFilter {
  contentType?: ClipboardContentType[];
  isFavorite?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
  search?: string;
  projectId?: UUID | null;
}

// ============== FILE PREVIEW ==============

export type PreviewType = "image" | "pdf" | "markdown" | "text" | "code" | "json" | "csv" | "html" | "unsupported";

export interface FilePreview {
  fileId: UUID;
  type: PreviewType;
  content: string | null; // Text content for preview
  thumbnail: string | null; // Data URL for thumbnail
  language: string | null; // For code highlighting
  lineCount: number;
  isLarge: boolean;
  error: string | null;
}

// ============== SUPPORTED FILE TYPES ==============

export const SUPPORTED_MIME_TYPES: Record<string, string[]> = {
  // Documents
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt", ".md", ".markdown"],
  "text/markdown": [".md", ".markdown"],

  // Data
  "text/csv": [".csv"],
  "application/json": [".json"],
  "application/xml": [".xml"],
  "text/yaml": [".yaml", ".yml"],

  // Images
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/gif": [".gif"],
  "image/svg+xml": [".svg"],
  "image/webp": [".webp"],

  // Archives
  "application/zip": [".zip"],
  "application/x-tar": [".tar"],
  "application/gzip": [".gz", ".tar.gz"],

  // Code
  "text/javascript": [".js", ".jsx", ".mjs", ".cjs"],
  "application/typescript": [".ts", ".tsx"],
  "text/x-python": [".py"],
  "text/x-go": [".go"],
  "text/x-rust": [".rs"],
  "text/x-java": [".java"],
  "text/x-c": [".c", ".h"],
  "text/x-c++": [".cpp", ".hpp", ".cc"],
  "text/x-csharp": [".cs"],
  "text/html": [".html", ".htm"],
  "text/css": [".css", ".scss", ".sass", ".less"],
  "application/sql": [".sql"],
  "text/x-sh": [".sh", ".bash", ".zsh"],

  // Framework
  "text/x-vue": [".vue"],
  "text/x-svelte": [".svelte"],
  "text/x-php": [".php"],
  "text/x-ruby": [".rb"],
  "text/x-swift": [".swift"],
  "text/x-kotlin": [".kt", ".kts"],
};

export const CODE_EXTENSIONS = [
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "pyw", "pyi",
  "go", "rs", "java", "kt", "kts",
  "c", "h", "cpp", "hpp", "cc", "cxx",
  "cs", "vb",
  "html", "htm", "css", "scss", "sass", "less",
  "sql", "sh", "bash", "zsh", "ps1",
  "vue", "svelte", "astro",
  "php", "rb", "swift", "scala", "ex", "exs",
  "dart", "lua", "r", "m", "mm",
  "json", "yaml", "yml", "xml", "toml",
];

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"];

export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "txt", "md", "rtf"];

export const DATA_EXTENSIONS = ["csv", "json", "xml", "yaml", "yml"];

// ============== FACTORY FUNCTIONS ==============

export function createEmptyFile(projectId: UUID, data: Partial<WorkspaceFile>): WorkspaceFile {
  return {
    id: crypto.randomUUID(),
    projectId,
    name: data.name || "Untitled",
    originalName: data.originalName || data.name || "Untitled",
    extension: data.extension || "",
    mimeType: data.mimeType || "application/octet-stream",
    size: data.size || 0,
    storagePath: data.storagePath || "",
    storageType: data.storageType || "local",
    storageData: data.storageData,
    folderId: data.folderId || null,
    tags: data.tags || [],
    isFavorite: data.isFavorite || false,
    isPinned: data.isPinned || false,
    isDeleted: false,
    description: data.description || null,
    previewText: data.previewText || null,
    thumbnailUrl: data.thumbnailUrl || null,
    viewCount: 0,
    downloadCount: 0,
    lastOpenedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  };
}

export function createEmptyNote(projectId: UUID, title = "Untitled Note"): Note {
  return {
    id: crypto.randomUUID(),
    projectId,
    title,
    content: "",
    folderId: null,
    tags: [],
    isFavorite: false,
    isPinned: false,
    isDeleted: false,
    isArchived: false,
    wordCount: 0,
    charCount: 0,
    readingTime: 0,
    version: 1,
    lastAutoSavedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  };
}

export function createEmptyTask(projectId: UUID, title = "Untitled Task"): Task {
  return {
    id: crypto.randomUUID(),
    projectId,
    title,
    description: "",
    status: "todo",
    priority: "medium",
    folderId: null,
    tags: [],
    progress: 0,
    dueDate: null,
    startedAt: null,
    completedAt: null,
    position: 0,
    isFavorite: false,
    isPinned: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  };
}

export function createEmptySnippet(projectId: UUID, title = "Untitled Snippet"): Snippet {
  return {
    id: crypto.randomUUID(),
    projectId,
    title,
    code: "",
    language: "text",
    type: "code",
    folderId: null,
    tags: [],
    useCount: 0,
    lastUsedAt: null,
    isFavorite: false,
    isPinned: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  };
}

export function createClipboardItem(content: string, projectId: UUID | null = null): ClipboardItem {
  const charCount = content.length;
  const lineCount = content.split("\n").length;

  return {
    id: crypto.randomUUID(),
    projectId,
    content,
    contentType: detectContentType(content),
    detectedLanguage: detectLanguage(content),
    sourceUrl: null,
    sourceApp: null,
    charCount,
    lineCount,
    isFavorite: false,
    isPinned: false,
    isDeleted: false,
    isSensitive: false,
    copyCount: 1,
    lastCopiedAt: Date.now(),
    createdAt: Date.now(),
    deletedAt: null,
    expiresAt: null,
  };
}

export function createFolder(projectId: UUID, name: string, parentId: UUID | null = null): Folder {
  return {
    id: crypto.randomUUID(),
    projectId,
    parentId,
    name,
    path: `/${name}/`,
    color: null,
    icon: null,
    isFavorite: false,
    isPinned: false,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ============== UTILITY FUNCTIONS ==============

export function detectContentType(content: string): ClipboardContentType {
  // Check for URLs
  if (/^https?:\/\//.test(content.trim())) {
    return "link";
  }

  // Check for file paths
  if (/^[\/]|^[A-Za-z]:\\/.test(content.trim())) {
    return "path";
  }

  // Check for commands (shell-like)
  if (/^(npm|yarn|pnpm|git|docker|kubectl|curl|wget|echo|cd|ls|mkdir|rm)\s/.test(content.trim())) {
    return "command";
  }

  // Check for code-like patterns
  if (/[{}\[\]();]/.test(content) || /^\s*(function|const|let|var|if|for|while|def|class)\s/.test(content)) {
    return "code";
  }

  // Check for AI prompts
  if (/^(You are|Act as|As a|Please|Generate|Write|Create|Explain|Help me)/i.test(content.trim())) {
    return "prompt";
  }

  return "text";
}

export function detectLanguage(content: string): string | null {
  // Simple heuristics for language detection
  if (/^\s*<\?php/.test(content)) return "php";
  if (/^\s*<!DOCTYPE html|<html/i.test(content)) return "html";
  if (/^\s*<\?xml/.test(content)) return "xml";
  if (/^\s*package\s+\w+/.test(content)) return "go";
  if (/^\s*use\s+strict|^\s*function\s+\w+\s*\(|^\s*const\s+\w+\s*=/.test(content)) return "javascript";
  if (/^\s*import\s+.*from\s+['"]/.test(content) || /^\s*export\s+/.test(content)) return "typescript";
  if (/^\s*def\s+\w+|^\s*class\s+\w+|^\s*import\s+\w+/.test(content)) return "python";
  if (/^\s*func\s+\w+|^\s*package\s+\w+/.test(content)) return "go";
  if (/^\s*fn\s+\w+|^\s*let\s+\w+:\s*|^\s*pub\s+fn/.test(content)) return "rust";
  if (/^\s*SELECT\s+|^\s*INSERT\s+|^\s*UPDATE\s+|^\s*DELETE\s+/i.test(content)) return "sql";
  if (/^\s*\{\s*"[^"]+"\s*:/.test(content)) return "json";
  if (/^\s*---\s*$|^\s*[\w\-]+:\s*/.test(content)) return "yaml";
  if (/#\s*!/.test(content)) return "shell";

  return null;
}

export function getExtensionFromMime(mimeType: string): string {
  const extensions = SUPPORTED_MIME_TYPES[mimeType];
  return extensions ? extensions[0].replace(".", "") : "";
}

export function getMimeFromExtension(extension: string): string {
  const ext = extension.replace(".", "").toLowerCase();
  for (const [mime, exts] of Object.entries(SUPPORTED_MIME_TYPES)) {
    if (exts.some(e => e.replace(".", "").toLowerCase() === ext)) {
      return mime;
    }
  }
  return "application/octet-stream";
}

export function isImageFile(extension: string): boolean {
  return IMAGE_EXTENSIONS.includes(extension.replace(".", "").toLowerCase());
}

export function isCodeFile(extension: string): boolean {
  return CODE_EXTENSIONS.includes(extension.replace(".", "").toLowerCase());
}

export function isDocumentFile(extension: string): boolean {
  return DOCUMENT_EXTENSIONS.includes(extension.replace(".", "").toLowerCase());
}

export function isDataFile(extension: string): boolean {
  return DATA_EXTENSIONS.includes(extension.replace(".", "").toLowerCase());
}

export function getPreviewType(file: WorkspaceFile): PreviewType {
  const ext = file.extension.replace(".", "").toLowerCase();

  if (isImageFile(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "json") return "json";
  if (ext === "csv") return "csv";
  if (ext === "html" || ext === "htm") return "html";
  if (isCodeFile(ext)) return "code";
  if (isDataFile(ext) || isDocumentFile(ext)) return "text";

  return "unsupported";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function calculateReadingTime(wordCount: number): number {
  // Average reading speed: 200-250 words per minute
  return Math.max(1, Math.ceil(wordCount / 225));
}

export function getTaskStatusColor(status: TaskStatus): string {
  switch (status) {
    case "todo": return "gray";
    case "in_progress": return "blue";
    case "review": return "yellow";
    case "done": return "green";
    case "archived": return "slate";
  }
}

export function getTaskPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case "low": return "slate";
    case "medium": return "blue";
    case "high": return "orange";
    case "urgent": return "red";
  }
}

export function getTaskStats(tasks: Task[]): TaskStats {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  return {
    total: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    review: tasks.filter(t => t.status === "review").length,
    done: tasks.filter(t => t.status === "done").length,
    archived: tasks.filter(t => t.status === "archived").length,
    overdue: tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== "done").length,
    dueToday: tasks.filter(t => t.dueDate === today).length,
    dueThisWeek: tasks.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= weekFromNow).length,
  };
}
