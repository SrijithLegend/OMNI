/**
 * Workspace Hooks — React hooks for workspace engines integration.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import type { UUID } from "@/types/omni";
import { FileLibraryEngine } from "@/engines/file-library";
import { NotesEngine } from "@/engines/notes";
import { TasksEngine } from "@/engines/tasks";
import { SnippetsEngine } from "@/engines/snippets";
import { ClipboardEngine } from "@/engines/clipboard";
import { PinnedItemsEngine, ActivityEngine } from "@/engines/activity";
import type {
  WorkspaceFile,
  Note,
  Task,
  Snippet,
  ClipboardItem,
  PinnedItem,
  ActivityItem,
  TaskStats,
  TaskStatus,
  SnippetType,
  FilePreview,
  Folder,
} from "@/models/workspace";
import { getTaskStats } from "@/models/workspace";

// ============== WORKSPACE CONTEXT ==============

interface WorkspaceContextValue {
  projectId: UUID | null;
  isReady: boolean;

  // Engines (lazy-initialized)
  fileEngine: FileLibraryEngine | null;
  notesEngine: NotesEngine | null;
  tasksEngine: TasksEngine | null;
  snippetsEngine: SnippetsEngine | null;
  clipboardEngine: ClipboardEngine | null;
  pinnedEngine: PinnedItemsEngine | null;
  activityEngine: ActivityEngine | null;

  // State
  files: WorkspaceFile[];
  notes: Note[];
  tasks: Task[];
  snippets: Snippet[];
  clipboardItems: ClipboardItem[];
  pinnedItems: PinnedItem[];
  recentActivity: ActivityItem[];
  noteFolders: Folder[];
  snippetFolders: Folder[];

  // Loading states
  filesLoading: boolean;
  notesLoading: boolean;
  tasksLoading: boolean;
  snippetsLoading: boolean;
  clipboardLoading: boolean;

  // Task stats
  taskStats: TaskStats;

  // File actions
  uploadFiles: (files: File[]) => Promise<void>;
  deleteFile: (fileId: UUID) => Promise<void>;
  toggleFileFavorite: (fileId: UUID) => Promise<void>;
  toggleFilePinned: (fileId: UUID) => Promise<void>;
  downloadFile: (fileId: UUID) => Promise<void>;
  getFilePreview: (fileId: UUID) => Promise<FilePreview | null>;

  // Note actions
  createNote: (title: string) => Promise<Note>;
  updateNote: (noteId: UUID, title: string, content: string) => Promise<void>;
  deleteNote: (noteId: UUID) => Promise<void>;
  toggleNoteFavorite: (noteId: UUID) => Promise<void>;
  toggleNotePinned: (noteId: UUID) => Promise<void>;
  archiveNote: (noteId: UUID) => Promise<void>;
  autoSaveNote: (noteId: UUID, content: string) => void;

  // Task actions
  createTask: (title: string, description?: string) => Promise<Task>;
  updateTask: (taskId: UUID, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: UUID) => Promise<void>;
  moveTask: (taskId: UUID, newStatus: TaskStatus, newPosition: number) => Promise<void>;

  // Snippet actions
  createSnippet: (title: string, code: string, type: SnippetType, language: string) => Promise<Snippet>;
  updateSnippet: (snippetId: UUID, updates: Partial<Snippet>) => Promise<void>;
  deleteSnippet: (snippetId: UUID) => Promise<void>;
  copySnippet: (snippetId: UUID) => void;

  // Clipboard actions
  deleteClipboardItem: (itemId: UUID) => Promise<void>;
  toggleClipboardFavorite: (itemId: UUID) => Promise<void>;
  toggleClipboardPinned: (itemId: UUID) => Promise<void>;
  copyClipboardItem: (itemId: UUID) => void;
  clearClipboardHistory: () => Promise<void>;

  // Load functions
  loadFiles: () => Promise<void>;
  loadNotes: () => Promise<void>;
  loadTasks: () => Promise<void>;
  loadSnippets: () => Promise<void>;
  loadClipboard: () => Promise<void>;
  loadPinnedItems: () => Promise<void>;
  loadActivity: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ============== WORKSPACE PROVIDER ==============

interface WorkspaceProviderProps {
  projectId: UUID | null;
  children: ReactNode;
}

export function WorkspaceProvider({ projectId, children }: WorkspaceProviderProps) {
  // Engine refs (lazy-initialized)
  const fileEngineRef = useRef<FileLibraryEngine | null>(null);
  const notesEngineRef = useRef<NotesEngine | null>(null);
  const tasksEngineRef = useRef<TasksEngine | null>(null);
  const snippetsEngineRef = useRef<SnippetsEngine | null>(null);
  const clipboardEngineRef = useRef<ClipboardEngine | null>(null);
  const pinnedEngineRef = useRef<PinnedItemsEngine | null>(null);
  const activityEngineRef = useRef<ActivityEngine | null>(null);

  // Auto-save debounce ref
  const autoSaveTimeoutRef = useRef<Map<UUID, ReturnType<typeof setTimeout>>>(new Map());

  // State
  const [isReady, setIsReady] = useState(false);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  // Loading states
  const [filesLoading, setFilesLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [snippetsLoading, setSnippetsLoading] = useState(false);
  const [clipboardLoading, setClipboardLoading] = useState(false);

  // Task stats (memoized)
  const taskStats = useMemo(() => getTaskStats(tasks), [tasks]);

  // Initialize engines when project changes
  useEffect(() => {
    if (!projectId) {
      setIsReady(false);
      return;
    }

    const initEngines = async () => {
      // Initialize file engine
      if (!fileEngineRef.current) {
        fileEngineRef.current = new FileLibraryEngine();
      }
      await fileEngineRef.current.start();

      // Initialize notes engine
      if (!notesEngineRef.current) {
        notesEngineRef.current = new NotesEngine();
      }
      await notesEngineRef.current.start();

      // Initialize tasks engine
      if (!tasksEngineRef.current) {
        tasksEngineRef.current = new TasksEngine();
      }
      await tasksEngineRef.current.start();

      // Initialize snippets engine
      if (!snippetsEngineRef.current) {
        snippetsEngineRef.current = new SnippetsEngine();
      }
      await snippetsEngineRef.current.start();

      // Initialize clipboard engine
      if (!clipboardEngineRef.current) {
        clipboardEngineRef.current = new ClipboardEngine();
      }
      await clipboardEngineRef.current.start();

      // Initialize pinned items engine
      if (!pinnedEngineRef.current) {
        pinnedEngineRef.current = new PinnedItemsEngine();
      }
      await pinnedEngineRef.current.start();

      // Initialize activity engine
      if (!activityEngineRef.current) {
        activityEngineRef.current = new ActivityEngine();
      }
      await activityEngineRef.current.start();

      setIsReady(true);

      // Load initial data
      await Promise.all([
        loadFilesInternal(fileEngineRef.current, projectId, setFiles, setFilesLoading),
        loadNotesInternal(notesEngineRef.current, projectId, setNotes, setNotesLoading),
        loadTasksInternal(tasksEngineRef.current, projectId, setTasks, setTasksLoading),
        loadSnippetsInternal(snippetsEngineRef.current, projectId, setSnippets, setSnippetsLoading),
        loadClipboardInternal(clipboardEngineRef.current, projectId, setClipboardItems, setClipboardLoading),
      ]);
    };

    initEngines();

    return () => {
      // Stop engines on cleanup
      fileEngineRef.current?.stop();
      notesEngineRef.current?.stop();
      tasksEngineRef.current?.stop();
      snippetsEngineRef.current?.stop();
      clipboardEngineRef.current?.stop();
      pinnedEngineRef.current?.stop();
      activityEngineRef.current?.stop();
    };
  }, [projectId]);

  // Internal load functions
  const loadFilesInternal = async (
    engine: FileLibraryEngine,
    pid: UUID,
    setter: (f: WorkspaceFile[]) => void,
    setLoading: (l: boolean) => void
  ) => {
    setLoading(true);
    try {
      const files = await engine.listFiles(pid);
      setter(files.filter(f => !f.isDeleted));
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadNotesInternal = async (
    engine: NotesEngine,
    pid: UUID,
    setter: (n: Note[]) => void,
    setLoading: (l: boolean) => void
  ) => {
    setLoading(true);
    try {
      const notes = await engine.listNotes(pid);
      setter(notes.filter(n => !n.isDeleted && !n.isArchived));
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTasksInternal = async (
    engine: TasksEngine,
    pid: UUID,
    setter: (t: Task[]) => void,
    setLoading: (l: boolean) => void
  ) => {
    setLoading(true);
    try {
      const tasks = await engine.listTasks(pid);
      setter(tasks.filter(t => !t.isDeleted));
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSnippetsInternal = async (
    engine: SnippetsEngine,
    pid: UUID,
    setter: (s: Snippet[]) => void,
    setLoading: (l: boolean) => void
  ) => {
    setLoading(true);
    try {
      const snippets = await engine.listSnippets(pid);
      setter(snippets.filter(s => !s.isDeleted));
    } catch (err) {
      console.error("Failed to load snippets:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadClipboardInternal = async (
    engine: ClipboardEngine,
    pid: UUID,
    setter: (c: ClipboardItem[]) => void,
    setLoading: (l: boolean) => void
  ) => {
    setLoading(true);
    try {
      const items = await engine.listItems(pid);
      setter(items.filter(i => !i.isDeleted));
    } catch (err) {
      console.error("Failed to load clipboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // Public load functions
  const loadFiles = useCallback(async () => {
    if (!fileEngineRef.current || !projectId) return;
    await loadFilesInternal(fileEngineRef.current, projectId, setFiles, setFilesLoading);
  }, [projectId]);

  const loadNotes = useCallback(async () => {
    if (!notesEngineRef.current || !projectId) return;
    await loadNotesInternal(notesEngineRef.current, projectId, setNotes, setNotesLoading);
  }, [projectId]);

  const loadTasks = useCallback(async () => {
    if (!tasksEngineRef.current || !projectId) return;
    await loadTasksInternal(tasksEngineRef.current, projectId, setTasks, setTasksLoading);
  }, [projectId]);

  const loadSnippets = useCallback(async () => {
    if (!snippetsEngineRef.current || !projectId) return;
    await loadSnippetsInternal(snippetsEngineRef.current, projectId, setSnippets, setSnippetsLoading);
  }, [projectId]);

  const loadClipboard = useCallback(async () => {
    if (!clipboardEngineRef.current || !projectId) return;
    await loadClipboardInternal(clipboardEngineRef.current, projectId, setClipboardItems, setClipboardLoading);
  }, [projectId]);

  const loadPinnedItems = useCallback(async () => {
    if (!pinnedEngineRef.current || !projectId) return;
    const items = await pinnedEngineRef.current.listPinnedItems(projectId);
    setPinnedItems(items);
  }, [projectId]);

  const loadActivity = useCallback(async () => {
    if (!activityEngineRef.current || !projectId) return;
    const activity = await activityEngineRef.current.getRecentActivity(projectId, 50);
    setRecentActivity(activity);
  }, [projectId]);

  // File actions
  const uploadFiles = useCallback(async (fileList: File[]) => {
    if (!fileEngineRef.current || !projectId) return;
    for (const file of fileList) {
      await fileEngineRef.current.uploadFile({ file, projectId });
    }
    await loadFiles();
  }, [projectId, loadFiles]);

  const deleteFile = useCallback(async (fileId: UUID) => {
    if (!fileEngineRef.current) return;
    await fileEngineRef.current.deleteFile(fileId);
    await loadFiles();
  }, [loadFiles]);

  const toggleFileFavorite = useCallback(async (fileId: UUID) => {
    if (!fileEngineRef.current) return;
    await fileEngineRef.current.toggleFavorite(fileId);
    await loadFiles();
  }, [loadFiles]);

  const toggleFilePinned = useCallback(async (fileId: UUID) => {
    if (!fileEngineRef.current) return;
    await fileEngineRef.current.togglePinned(fileId);
    await loadFiles();
  }, [loadFiles]);

  const downloadFile = useCallback(async (fileId: UUID) => {
    if (!fileEngineRef.current) return;
    await fileEngineRef.current.downloadFile(fileId);
  }, []);

  const getFilePreview = useCallback(async (fileId: UUID): Promise<FilePreview | null> => {
    if (!fileEngineRef.current) return null;
    return fileEngineRef.current.getPreview(fileId);
  }, []);

  // Note actions
  const createNote = useCallback(async (title: string): Promise<Note> => {
    if (!notesEngineRef.current || !projectId) throw new Error("Engine not ready");
    const note = await notesEngineRef.current.createNote(projectId, title);
    await loadNotes();
    return note;
  }, [projectId, loadNotes]);

  const updateNote = useCallback(async (noteId: UUID, title: string, content: string) => {
    if (!notesEngineRef.current) return;
    await notesEngineRef.current.updateNote(noteId, { title, content });
    await loadNotes();
  }, [loadNotes]);

  const deleteNote = useCallback(async (noteId: UUID) => {
    if (!notesEngineRef.current) return;
    await notesEngineRef.current.deleteNote(noteId);
    await loadNotes();
  }, [loadNotes]);

  const toggleNoteFavorite = useCallback(async (noteId: UUID) => {
    if (!notesEngineRef.current) return;
    await notesEngineRef.current.toggleFavorite(noteId);
    await loadNotes();
  }, [loadNotes]);

  const toggleNotePinned = useCallback(async (noteId: UUID) => {
    if (!notesEngineRef.current) return;
    await notesEngineRef.current.togglePinned(noteId);
    await loadNotes();
  }, [loadNotes]);

  const archiveNote = useCallback(async (noteId: UUID) => {
    if (!notesEngineRef.current) return;
    await notesEngineRef.current.archiveNote(noteId);
    await loadNotes();
  }, [loadNotes]);

  const autoSaveNote = useCallback((noteId: UUID, content: string) => {
    // Clear existing timeout
    const existing = autoSaveTimeoutRef.current.get(noteId);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timeout (2 second debounce)
    const timeout = setTimeout(async () => {
      if (notesEngineRef.current) {
        await notesEngineRef.current.updateNote(noteId, { content });
        await loadNotes();
      }
      autoSaveTimeoutRef.current.delete(noteId);
    }, 2000);

    autoSaveTimeoutRef.current.set(noteId, timeout);
  }, [loadNotes]);

  // Task actions
  const createTask = useCallback(async (title: string, description?: string): Promise<Task> => {
    if (!tasksEngineRef.current || !projectId) throw new Error("Engine not ready");
    const task = await tasksEngineRef.current.createTask(projectId, title, description || "");
    await loadTasks();
    return task;
  }, [projectId, loadTasks]);

  const updateTask = useCallback(async (taskId: UUID, updates: Partial<Task>) => {
    if (!tasksEngineRef.current) return;
    await tasksEngineRef.current.updateTask(taskId, updates);
    await loadTasks();
  }, [loadTasks]);

  const deleteTask = useCallback(async (taskId: UUID) => {
    if (!tasksEngineRef.current) return;
    await tasksEngineRef.current.deleteTask(taskId);
    await loadTasks();
  }, [loadTasks]);

  const moveTask = useCallback(async (taskId: UUID, newStatus: TaskStatus, newPosition: number) => {
    if (!tasksEngineRef.current) return;
    await tasksEngineRef.current.reorderTask(taskId, newStatus, newPosition);
    await loadTasks();
  }, [loadTasks]);

  // Snippet actions
  const createSnippet = useCallback(async (
    title: string,
    code: string,
    type: SnippetType,
    language: string
  ): Promise<Snippet> => {
    if (!snippetsEngineRef.current || !projectId) throw new Error("Engine not ready");
    const snippet = await snippetsEngineRef.current.createSnippet(projectId, title, code, type, language);
    await loadSnippets();
    return snippet;
  }, [projectId, loadSnippets]);

  const updateSnippet = useCallback(async (snippetId: UUID, updates: Partial<Snippet>) => {
    if (!snippetsEngineRef.current) return;
    await snippetsEngineRef.current.updateSnippet(snippetId, updates);
    await loadSnippets();
  }, [loadSnippets]);

  const deleteSnippet = useCallback(async (snippetId: UUID) => {
    if (!snippetsEngineRef.current) return;
    await snippetsEngineRef.current.deleteSnippet(snippetId);
    await loadSnippets();
  }, [loadSnippets]);

  const copySnippet = useCallback((snippetId: UUID) => {
    const snippet = snippets.find(s => s.id === snippetId);
    if (snippet) {
      navigator.clipboard.writeText(snippet.code);
      // Update use count via engine
      snippetsEngineRef.current?.updateSnippet(snippetId, {
        useCount: snippet.useCount + 1,
        lastUsedAt: Date.now()
      });
      loadSnippets();
    }
  }, [snippets, loadSnippets]);

  // Clipboard actions
  const deleteClipboardItem = useCallback(async (itemId: UUID) => {
    if (!clipboardEngineRef.current) return;
    await clipboardEngineRef.current.deleteItem(itemId);
    await loadClipboard();
  }, [loadClipboard]);

  const toggleClipboardFavorite = useCallback(async (itemId: UUID) => {
    if (!clipboardEngineRef.current) return;
    await clipboardEngineRef.current.toggleFavorite(itemId);
    await loadClipboard();
  }, [loadClipboard]);

  const toggleClipboardPinned = useCallback(async (itemId: UUID) => {
    if (!clipboardEngineRef.current) return;
    await clipboardEngineRef.current.togglePinned(itemId);
    await loadClipboard();
  }, [loadClipboard]);

  const copyClipboardItem = useCallback((itemId: UUID) => {
    const item = clipboardItems.find(i => i.id === itemId);
    if (item) {
      navigator.clipboard.writeText(item.content);
      clipboardEngineRef.current?.updateItem(itemId, {
        copyCount: item.copyCount + 1,
        lastCopiedAt: Date.now()
      });
      loadClipboard();
    }
  }, [clipboardItems, loadClipboard]);

  const clearClipboardHistory = useCallback(async () => {
    if (!clipboardEngineRef.current || !projectId) return;
    await clipboardEngineRef.current.clearHistory(projectId);
    await loadClipboard();
  }, [projectId, loadClipboard]);

  const value: WorkspaceContextValue = {
    projectId,
    isReady,

    fileEngine: fileEngineRef.current,
    notesEngine: notesEngineRef.current,
    tasksEngine: tasksEngineRef.current,
    snippetsEngine: snippetsEngineRef.current,
    clipboardEngine: clipboardEngineRef.current,
    pinnedEngine: pinnedEngineRef.current,
    activityEngine: activityEngineRef.current,

    files,
    notes,
    tasks,
    snippets,
    clipboardItems,
    pinnedItems,
    recentActivity,
    noteFolders: [],
    snippetFolders: [],

    filesLoading,
    notesLoading,
    tasksLoading,
    snippetsLoading,
    clipboardLoading,

    taskStats,

    uploadFiles,
    deleteFile,
    toggleFileFavorite,
    toggleFilePinned,
    downloadFile,
    getFilePreview,

    createNote,
    updateNote,
    deleteNote,
    toggleNoteFavorite,
    toggleNotePinned,
    archiveNote,
    autoSaveNote,

    createTask,
    updateTask,
    deleteTask,
    moveTask,

    createSnippet,
    updateSnippet,
    deleteSnippet,
    copySnippet,

    deleteClipboardItem,
    toggleClipboardFavorite,
    toggleClipboardPinned,
    copyClipboardItem,
    clearClipboardHistory,

    loadFiles,
    loadNotes,
    loadTasks,
    loadSnippets,
    loadClipboard,
    loadPinnedItems,
    loadActivity,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ============== HOOKS ==============

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}

export function useFileLibrary() {
  const { files, filesLoading, uploadFiles, deleteFile, toggleFileFavorite, toggleFilePinned, downloadFile, getFilePreview, loadFiles } = useWorkspace();
  return {
    files,
    loading: filesLoading,
    uploadFiles,
    deleteFile,
    toggleFileFavorite,
    toggleFilePinned,
    downloadFile,
    getFilePreview,
    loadFiles,
  };
}

export function useNotes() {
  const {
    notes, noteFolders, notesLoading,
    createNote, updateNote, deleteNote, toggleNoteFavorite, toggleNotePinned, archiveNote, autoSaveNote, loadNotes
  } = useWorkspace();
  return {
    notes,
    folders: noteFolders,
    loading: notesLoading,
    createNote,
    updateNote,
    deleteNote,
    toggleNoteFavorite,
    toggleNotePinned,
    archiveNote,
    autoSaveNote,
    loadNotes,
  };
}

export function useTasks() {
  const {
    tasks, taskStats, tasksLoading,
    createTask, updateTask, deleteTask, moveTask, loadTasks
  } = useWorkspace();
  return {
    tasks,
    stats: taskStats,
    loading: tasksLoading,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    loadTasks,
  };
}

export function useSnippets() {
  const {
    snippets, snippetFolders, snippetsLoading,
    createSnippet, updateSnippet, deleteSnippet, copySnippet, loadSnippets
  } = useWorkspace();
  return {
    snippets,
    folders: snippetFolders,
    loading: snippetsLoading,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    copySnippet,
    loadSnippets,
  };
}

export function useClipboard() {
  const {
    clipboardItems, clipboardLoading,
    deleteClipboardItem, toggleClipboardFavorite, toggleClipboardPinned, copyClipboardItem, clearClipboardHistory, loadClipboard
  } = useWorkspace();
  return {
    items: clipboardItems,
    loading: clipboardLoading,
    deleteItem: deleteClipboardItem,
    toggleFavorite: toggleClipboardFavorite,
    togglePinned: toggleClipboardPinned,
    copyItem: copyClipboardItem,
    clearHistory: clearClipboardHistory,
    loadClipboard,
  };
}
