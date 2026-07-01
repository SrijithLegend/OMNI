/**
 * Notes — Markdown notes UI components for the workspace.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Plus, Search, Trash2, Star, Pin, MoveVertical as MoreVertical, Save, Clock, Archive, FolderPlus, ChevronRight, Bold, Italic, List, ListOrdered, Code, Link, Image, Quote, Heading1, Heading2, Heading3, SquareCheck as CheckSquare, X, Loader as Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UUID } from "@/types/omni";
import type { Note, NoteVersion, Folder } from "@/models/workspace";

// ============== NOTE CARD COMPONENT ==============

interface NoteCardProps {
  note: Note;
  onClick?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onTogglePinned?: () => void;
  onArchive?: () => void;
  selected?: boolean;
  compact?: boolean;
}

export function NoteCard({
  note,
  onClick,
  onDelete,
  onToggleFavorite,
  onTogglePinned,
  onArchive,
  selected = false,
  compact = false,
}: NoteCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getPreview = (content: string, maxLength = 100) => {
    const clean = content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/[#*_~>`-]/g, "")
      .replace(/\n+/g, " ")
      .trim();
    return clean.length > maxLength ? clean.slice(0, maxLength) + "..." : clean;
  };

  if (compact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
          "hover:bg-muted/50",
          selected && "bg-primary/10"
        )}
        onClick={onClick}
      >
        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="truncate text-sm">{note.title}</span>
        {note.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group relative p-4 rounded-lg border transition-all cursor-pointer",
        "hover:shadow-sm hover:border-primary/20",
        selected && "bg-primary/10 border-primary",
        note.isArchived && "opacity-60"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {note.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
          {note.isPinned && <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />}
          <h3 className="font-medium truncate">{note.title}</h3>
        </div>

        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded hover:bg-muted"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-6 z-10 w-40 bg-background border rounded-lg shadow-lg overflow-hidden"
              >
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onToggleFavorite();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Star className="w-4 h-4" /> {note.isFavorite ? "Unfavorite" : "Favorite"}
                  </button>
                )}
                {onTogglePinned && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onTogglePinned();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Pin className="w-4 h-4" /> {note.isPinned ? "Unpin" : "Pin"}
                  </button>
                )}
                {onArchive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onArchive();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" /> Archive
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-red-500"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Preview */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {getPreview(note.content) || "No content"}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(note.updatedAt)}
        </span>
        {note.wordCount > 0 && (
          <span>{note.wordCount} words</span>
        )}
        {note.readingTime > 0 && (
          <span>{note.readingTime} min read</span>
        )}
      </div>
    </motion.div>
  );
}

// ============== MARKDOWN EDITOR TOOLBAR ==============

interface MarkdownToolbarProps {
  onBold?: () => void;
  onItalic?: () => void;
  onHeading?: (level: 1 | 2 | 3) => void;
  onLink?: () => void;
  onImage?: () => void;
  onCode?: () => void;
  onQuote?: () => void;
  onList?: () => void;
  onOrderedList?: () => void;
  onCheckList?: () => void;
  className?: string;
}

export function MarkdownToolbar({
  onBold,
  onItalic,
  onHeading,
  onLink,
  onImage,
  onCode,
  onQuote,
  onList,
  onOrderedList,
  onCheckList,
  className,
}: MarkdownToolbarProps) {
  const toolbarItems: { icon: React.ReactNode; onClick?: () => void; title: string }[] = [
    { icon: <Bold className="w-4 h-4" />, onClick: onBold, title: "Bold" },
    { icon: <Italic className="w-4 h-4" />, onClick: onItalic, title: "Italic" },
    { icon: <Heading1 className="w-4 h-4" />, onClick: () => onHeading?.(1), title: "Heading 1" },
    { icon: <Heading2 className="w-4 h-4" />, onClick: () => onHeading?.(2), title: "Heading 2" },
    { icon: <Heading3 className="w-4 h-4" />, onClick: () => onHeading?.(3), title: "Heading 3" },
    { icon: <Link className="w-4 h-4" />, onClick: onLink, title: "Link" },
    { icon: <Image className="w-4 h-4" />, onClick: onImage, title: "Image" },
    { icon: <Code className="w-4 h-4" />, onClick: onCode, title: "Code" },
    { icon: <Quote className="w-4 h-4" />, onClick: onQuote, title: "Quote" },
    { icon: <List className="w-4 h-4" />, onClick: onList, title: "Bullet List" },
    { icon: <ListOrdered className="w-4 h-4" />, onClick: onOrderedList, title: "Numbered List" },
    { icon: <CheckSquare className="w-4 h-4" />, onClick: onCheckList, title: "Checklist" },
  ];

  return (
    <div className={cn("flex items-center gap-1 p-2 border-b", className)}>
      {toolbarItems.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          disabled={!item.onClick}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            !item.onClick && "opacity-50 cursor-not-allowed"
          )}
          title={item.title}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

// ============== MARKDOWN EDITOR COMPONENT ==============

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoSave?: boolean;
  onAutoSave?: () => void;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  autoFocus = false,
  autoSave = false,
  className,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);

  // Insert text at cursor position
  const insertAtCursor = (before: string, after = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = before + selectedText + after;

    const newValue = value.substring(0, start) + newText + value.substring(end);
    onChange(newValue);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(
        selectedText ? start : newCursorPos,
        selectedText ? start + newText.length : newCursorPos
      );
    }, 0);
  };

  const handleBold = () => insertAtCursor("**", "**");
  const handleItalic = () => insertAtCursor("*", "*");
  const handleHeading = (level: 1 | 2 | 3) => {
    insertAtCursor("#".repeat(level) + " ", "");
  };
  const handleLink = () => insertAtCursor("[", "](url)");
  const handleImage = () => insertAtCursor("![alt](", ")");
  const handleCode = () => insertAtCursor("`\n", "\n`");
  const handleQuote = () => insertAtCursor("> ", "");
  const handleList = () => insertAtCursor("- ", "");
  const handleOrderedList = () => insertAtCursor("1. ", "");
  const handleCheckList = () => insertAtCursor("- [ ] ", "");

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          handleBold();
          break;
        case "i":
          e.preventDefault();
          handleItalic();
          break;
        case "k":
          e.preventDefault();
          handleLink();
          break;
      }
    }
  };

  return (
    <div className={cn("flex flex-col border rounded-lg overflow-hidden", className)}>
      <MarkdownToolbar
        onBold={handleBold}
        onItalic={handleItalic}
        onHeading={handleHeading}
        onLink={handleLink}
        onImage={handleImage}
        onCode={handleCode}
        onQuote={handleQuote}
        onList={handleList}
        onOrderedList={handleOrderedList}
        onCheckList={handleCheckList}
      />

      <div className="relative flex-1 min-h-0">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full h-full p-4 resize-none focus:outline-none text-sm font-mono"
          spellCheck="true"
        />

        {autoSave && saving && (
          <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== NOTE EDITOR MODAL ==============

interface NoteEditorModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
  onAutoSave?: (content: string) => void;
  className?: string;
}

export function NoteEditorModal({
  note,
  isOpen,
  onClose,
  onSave,
  onAutoSave,
}: NoteEditorModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setHasChanges(false);
    }
  }, [note]);

  const handleSave = () => {
    onSave(title, content);
    setHasChanges(false);
  };

  const handleChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);

    if (onAutoSave) {
      onAutoSave(newContent);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex bg-background"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 border-b bg-background z-10">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Untitled Note"
            className="text-lg font-semibold bg-transparent border-none focus:outline-none flex-1"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                hasChanges
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="pt-16 h-full">
          <MarkdownEditor
            value={content}
            onChange={handleChange}
            placeholder="Start writing your note..."
            autoFocus
            autoSave={!!onAutoSave}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============== NOTE LIST COMPONENT ==============

interface NoteListProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  onNoteDelete: (note: Note) => void;
  onNoteFavorite: (note: Note) => void;
  onNotePin: (note: Note) => void;
  onNoteArchive: (note: Note) => void;
  selectedId?: UUID | null;
  loading?: boolean;
  emptyMessage?: string;
  gridView?: boolean;
  className?: string;
}

export function NoteList({
  notes,
  onNoteClick,
  onNoteDelete,
  onNoteFavorite,
  onNotePin,
  onNoteArchive,
  selectedId,
  loading = false,
  emptyMessage = "No notes yet",
  gridView = true,
  className,
}: NoteListProps) {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-32 rounded-lg bg-muted/30" />
          </div>
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Split pinned and regular notes
  const pinnedNotes = notes.filter(n => n.isPinned);
  const regularNotes = notes.filter(n => !n.isPinned);

  return (
    <div className={cn("space-y-4", className)}>
      {pinnedNotes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Pin className="w-3 h-3" /> Pinned
          </h3>
          <div className={cn(
            "grid gap-4",
            gridView && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          )}>
            <AnimatePresence mode="popLayout">
              {pinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onClick={() => onNoteClick(note)}
                  onDelete={() => onNoteDelete(note)}
                  onToggleFavorite={() => onNoteFavorite(note)}
                  onTogglePinned={() => onNotePin(note)}
                  onArchive={() => onNoteArchive(note)}
                  selected={selectedId === note.id}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {regularNotes.length > 0 && (
        <div className="space-y-2">
          {pinnedNotes.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground">Other Notes</h3>
          )}
          <div className={cn(
            "grid gap-4",
            gridView && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          )}>
            <AnimatePresence mode="popLayout">
              {regularNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onClick={() => onNoteClick(note)}
                  onDelete={() => onNoteDelete(note)}
                  onToggleFavorite={() => onNoteFavorite(note)}
                  onTogglePinned={() => onNotePin(note)}
                  onArchive={() => onNoteArchive(note)}
                  selected={selectedId === note.id}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== NOTES TAB COMPONENT ==============

interface NotesTabProps {
  projectId: UUID;
  notes: Note[];
  folders: Folder[];
  onCreateNote: (title: string) => void;
  onUpdateNote: (noteId: UUID, title: string, content: string) => void;
  onDeleteNote: (noteId: UUID) => void;
  onFavoriteNote: (noteId: UUID) => void;
  onPinNote: (noteId: UUID) => void;
  onArchiveNote: (noteId: UUID) => void;
  autoSaveNote: (noteId: UUID, content: string) => void;
  loading?: boolean;
  className?: string;
}

export function NotesTab({
  projectId: _projectId,
  notes,
  folders: _folders,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onFavoriteNote,
  onPinNote,
  onArchiveNote,
  autoSaveNote,
  loading = false,
  className,
}: NotesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const filteredNotes = useMemo(() => {
    let filtered = notes.filter(n => showArchived ? n.isArchived : !n.isArchived);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query) ||
        n.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [notes, searchQuery, showArchived]);

  const handleNoteClick = (note: Note) => {
    setEditingNote(note);
    setEditorOpen(true);
  };

  const handleSave = (title: string, content: string) => {
    if (editingNote) {
      onUpdateNote(editingNote.id, title, content);
    }
  };

  const handleAutoSave = (content: string) => {
    if (editingNote) {
      autoSaveNote(editingNote.id, content);
    }
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setEditingNote(null);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
            />
          </div>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
              showArchived ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <Archive className="w-4 h-4" />
            Archived
          </button>
        </div>

        <button
          onClick={() => onCreateNote("Untitled Note")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      {/* Note list */}
      <NoteList
        notes={filteredNotes}
        onNoteClick={handleNoteClick}
        onNoteDelete={(note) => onDeleteNote(note.id)}
        onNoteFavorite={(note) => onFavoriteNote(note.id)}
        onNotePin={(note) => onPinNote(note.id)}
        onNoteArchive={(note) => onArchiveNote(note.id)}
        loading={loading}
        emptyMessage={showArchived ? "No archived notes" : "No notes yet"}
      />

      {/* Editor modal */}
      <NoteEditorModal
        note={editingNote}
        isOpen={editorOpen}
        onClose={handleCloseEditor}
        onSave={handleSave}
        onAutoSave={handleAutoSave}
      />
    </div>
  );
}
