/**
 * Workspace Slice — Zustand store slice for workspace modules.
 */

import type { StateCreator } from "zustand";
import type { UUID } from "@/types/omni";
import type {
  WorkspaceFile,
  Note,
  Task,
  Snippet,
  ClipboardItem,
  PinnedItem,
  ActivityItem,
  Folder,
  TaskStats,
  StorageUsage,
} from "@/models/workspace";

// ============== STATE INTERFACE ==============

export interface WorkspaceSlice {
  // Files
  files: WorkspaceFile[];
  fileFolders: Folder[];
  selectedFileId: UUID | null;
  filesLoading: boolean;

  // Notes
  notes: Note[];
  noteFolders: Folder[];
  selectedNoteId: UUID | null;
  notesLoading: boolean;

  // Tasks
  tasks: Task[];
  taskFolders: Folder[];
  selectedTaskId: UUID | null;
  taskStats: TaskStats | null;
  tasksLoading: boolean;
  taskViewMode: "kanban" | "list";

  // Snippets
  snippets: Snippet[];
  snippetFolders: Folder[];
  selectedSnippetId: UUID | null;
  snippetsLoading: boolean;

  // Clipboard
  clipboardItems: ClipboardItem[];
  selectedClipboardId: UUID | null;
  clipboardLoading: boolean;
  clipboardEnabled: boolean;

  // Pinned Items
  pinnedItems: PinnedItem[];
  pinnedLoading: boolean;

  // Activity
  recentActivity: ActivityItem[];
  activityLoading: boolean;

  // Storage
  storageUsage: StorageUsage | null;

  // Workspace view
  workspaceTab: "files" | "notes" | "tasks" | "snippets" | "clipboard";
  workspaceSearch: string;
}

// ============== INITIAL STATE ==============

export const initialWorkspaceSlice: WorkspaceSlice = {
  // Files
  files: [],
  fileFolders: [],
  selectedFileId: null,
  filesLoading: false,

  // Notes
  notes: [],
  noteFolders: [],
  selectedNoteId: null,
  notesLoading: false,

  // Tasks
  tasks: [],
  taskFolders: [],
  selectedTaskId: null,
  taskStats: null,
  tasksLoading: false,
  taskViewMode: "kanban",

  // Snippets
  snippets: [],
  snippetFolders: [],
  selectedSnippetId: null,
  snippetsLoading: false,

  // Clipboard
  clipboardItems: [],
  selectedClipboardId: null,
  clipboardLoading: false,
  clipboardEnabled: true,

  // Pinned
  pinnedItems: [],
  pinnedLoading: false,

  // Activity
  recentActivity: [],
  activityLoading: false,

  // Storage
  storageUsage: null,

  // View
  workspaceTab: "files",
  workspaceSearch: "",
};

// ============== ACTIONS INTERFACE ==============

export interface WorkspaceActions {
  // Files
  setFiles: (files: WorkspaceFile[]) => void;
  addFile: (file: WorkspaceFile) => void;
  updateFile: (fileId: UUID, updates: Partial<WorkspaceFile>) => void;
  removeFile: (fileId: UUID) => void;
  setSelectedFile: (fileId: UUID | null) => void;
  setFilesLoading: (loading: boolean) => void;
  setFileFolders: (folders: Folder[]) => void;

  // Notes
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (noteId: UUID, updates: Partial<Note>) => void;
  removeNote: (noteId: UUID) => void;
  setSelectedNote: (noteId: UUID | null) => void;
  setNotesLoading: (loading: boolean) => void;
  setNoteFolders: (folders: Folder[]) => void;

  // Tasks
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: UUID, updates: Partial<Task>) => void;
  removeTask: (taskId: UUID) => void;
  setSelectedTask: (taskId: UUID | null) => void;
  setTasksLoading: (loading: boolean) => void;
  setTaskFolders: (folders: Folder[]) => void;
  setTaskStats: (stats: TaskStats | null) => void;
  setTaskViewMode: (mode: "kanban" | "list") => void;

  // Snippets
  setSnippets: (snippets: Snippet[]) => void;
  addSnippet: (snippet: Snippet) => void;
  updateSnippet: (snippetId: UUID, updates: Partial<Snippet>) => void;
  removeSnippet: (snippetId: UUID) => void;
  setSelectedSnippet: (snippetId: UUID | null) => void;
  setSnippetsLoading: (loading: boolean) => void;
  setSnippetFolders: (folders: Folder[]) => void;

  // Clipboard
  setClipboardItems: (items: ClipboardItem[]) => void;
  addClipboardItem: (item: ClipboardItem) => void;
  updateClipboardItem: (itemId: UUID, updates: Partial<ClipboardItem>) => void;
  removeClipboardItem: (itemId: UUID) => void;
  setSelectedClipboard: (itemId: UUID | null) => void;
  setClipboardLoading: (loading: boolean) => void;
  setClipboardEnabled: (enabled: boolean) => void;

  // Pinned Items
  setPinnedItems: (items: PinnedItem[]) => void;
  addPinnedItem: (item: PinnedItem) => void;
  removePinnedItem: (itemId: UUID) => void;
  setPinnedLoading: (loading: boolean) => void;

  // Activity
  setRecentActivity: (activity: ActivityItem[]) => void;
  addActivityItem: (item: ActivityItem) => void;
  setActivityLoading: (loading: boolean) => void;

  // Storage
  setStorageUsage: (usage: StorageUsage | null) => void;

  // View
  setWorkspaceTab: (tab: WorkspaceSlice["workspaceTab"]) => void;
  setWorkspaceSearch: (search: string) => void;

  // Reset
  resetWorkspace: () => void;
}

// ============== SLICE CREATOR ==============

export type WorkspaceStateSlice = WorkspaceSlice & WorkspaceActions;

export const createWorkspaceSlice: StateCreator<WorkspaceStateSlice, [], [], WorkspaceStateSlice> = (set) => ({
  ...initialWorkspaceSlice,

  // Files
  setFiles: (files) => set({ files }),
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  updateFile: (fileId, updates) => set((state) => ({
    files: state.files.map((f) => (f.id === fileId ? { ...f, ...updates } : f)),
  })),
  removeFile: (fileId) => set((state) => ({
    files: state.files.filter((f) => f.id !== fileId),
  })),
  setSelectedFile: (fileId) => set({ selectedFileId: fileId }),
  setFilesLoading: (loading) => set({ filesLoading: loading }),
  setFileFolders: (folders) => set({ fileFolders: folders }),

  // Notes
  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),
  updateNote: (noteId, updates) => set((state) => ({
    notes: state.notes.map((n) => (n.id === noteId ? { ...n, ...updates } : n)),
  })),
  removeNote: (noteId) => set((state) => ({
    notes: state.notes.filter((n) => n.id !== noteId),
  })),
  setSelectedNote: (noteId) => set({ selectedNoteId: noteId }),
  setNotesLoading: (loading) => set({ notesLoading: loading }),
  setNoteFolders: (folders) => set({ noteFolders: folders }),

  // Tasks
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
  })),
  removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== taskId),
  })),
  setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),
  setTasksLoading: (loading) => set({ tasksLoading: loading }),
  setTaskFolders: (folders) => set({ taskFolders: folders }),
  setTaskStats: (stats) => set({ taskStats: stats }),
  setTaskViewMode: (mode) => set({ taskViewMode: mode }),

  // Snippets
  setSnippets: (snippets) => set({ snippets }),
  addSnippet: (snippet) => set((state) => ({ snippets: [...state.snippets, snippet] })),
  updateSnippet: (snippetId, updates) => set((state) => ({
    snippets: state.snippets.map((s) => (s.id === snippetId ? { ...s, ...updates } : s)),
  })),
  removeSnippet: (snippetId) => set((state) => ({
    snippets: state.snippets.filter((s) => s.id !== snippetId),
  })),
  setSelectedSnippet: (snippetId) => set({ selectedSnippetId: snippetId }),
  setSnippetsLoading: (loading) => set({ snippetsLoading: loading }),
  setSnippetFolders: (folders) => set({ snippetFolders: folders }),

  // Clipboard
  setClipboardItems: (items) => set({ clipboardItems: items }),
  addClipboardItem: (item) => set((state) => ({
    clipboardItems: [item, ...state.clipboardItems],
  })),
  updateClipboardItem: (itemId, updates) => set((state) => ({
    clipboardItems: state.clipboardItems.map((i) =>
      i.id === itemId ? { ...i, ...updates } : i
    ),
  })),
  removeClipboardItem: (itemId) => set((state) => ({
    clipboardItems: state.clipboardItems.filter((i) => i.id !== itemId),
  })),
  setSelectedClipboard: (itemId) => set({ selectedClipboardId: itemId }),
  setClipboardLoading: (loading) => set({ clipboardLoading: loading }),
  setClipboardEnabled: (enabled) => set({ clipboardEnabled: enabled }),

  // Pinned
  setPinnedItems: (items) => set({ pinnedItems: items }),
  addPinnedItem: (item) => set((state) => ({
    pinnedItems: [...state.pinnedItems, item],
  })),
  removePinnedItem: (itemId) => set((state) => ({
    pinnedItems: state.pinnedItems.filter((i) => i.itemId !== itemId),
  })),
  setPinnedLoading: (loading) => set({ pinnedLoading: loading }),

  // Activity
  setRecentActivity: (activity) => set({ recentActivity: activity }),
  addActivityItem: (item) => set((state) => ({
    recentActivity: [item, ...state.recentActivity].slice(0, 100),
  })),
  setActivityLoading: (loading) => set({ activityLoading: loading }),

  // Storage
  setStorageUsage: (usage) => set({ storageUsage: usage }),

  // View
  setWorkspaceTab: (tab) => set({ workspaceTab: tab }),
  setWorkspaceSearch: (search) => set({ workspaceSearch: search }),

  // Reset
  resetWorkspace: () => set({ ...initialWorkspaceSlice }),
});
