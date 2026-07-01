/**
 * Snippets — Code snippets, prompts, and templates UI components.
 */

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code, Copy, Plus, Search, Trash2, Star, Pin, MoveVertical as MoreVertical, FileCode, Terminal, MessageSquare, FileJson, FileText, Database, ChevronRight, Check, FolderPlus, Clock, X, CreditCard as Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UUID } from "@/types/omni";
import type { Snippet, SnippetType, Folder } from "@/models/workspace";

// ============== SNIPPET TYPE ICONS ==============

interface SnippetTypeIconProps {
  type: SnippetType;
  className?: string;
  size?: number;
}

export function SnippetTypeIcon({ type, className, size = 16 }: SnippetTypeIconProps) {
  const icons: Record<SnippetType, React.ReactNode> = {
    code: <Code className={cn("text-blue-500", className)} size={size} />,
    prompt: <MessageSquare className={cn("text-purple-500", className)} size={size} />,
    template: <FileText className={cn("text-green-500", className)} size={size} />,
    command: <Terminal className={cn("text-yellow-500", className)} size={size} />,
    markdown: <FileText className={cn("text-orange-500", className)} size={size} />,
    json: <FileJson className={cn("text-cyan-500", className)} size={size} />,
    shell: <Terminal className={cn("text-teal-500", className)} size={size} />,
    sql: <Database className={cn("text-indigo-500", className)} size={size} />,
  };

  return icons[type] || <Code className={className} size={size} />;
}

// ============== SNIPPET CARD COMPONENT ==============

interface SnippetCardProps {
  snippet: Snippet;
  onClick?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onEdit?: () => void;
  selected?: boolean;
  compact?: boolean;
}

export function SnippetCard({
  snippet,
  onClick,
  onCopy,
  onDelete,
  onToggleFavorite,
  onEdit,
  selected = false,
  compact = false,
}: SnippetCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPreview = (code: string, maxLength = 150) => {
    const lines = code.split("\n");
    const preview = lines.slice(0, 5).join("\n");
    return preview.length > maxLength ? preview.slice(0, maxLength) + "..." : preview;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
        <SnippetTypeIcon type={snippet.type} size={14} />
        <span className="truncate text-sm flex-1">{snippet.title}</span>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative p-4 rounded-lg border bg-background transition-all",
        "hover:shadow-sm hover:border-primary/20",
        selected && "bg-primary/10 border-primary"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <SnippetTypeIcon type={snippet.type} />
          <span className="font-medium truncate">{snippet.title}</span>
          {snippet.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
          {snippet.isPinned && <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded hover:bg-muted"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-6 z-10 w-36 bg-background border rounded-lg shadow-lg overflow-hidden"
                >
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onEdit();
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" /> Edit
                    </button>
                  )}
                  {onToggleFavorite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onToggleFavorite();
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                    >
                      <Star className="w-4 h-4" /> {snippet.isFavorite ? "Unfavorite" : "Favorite"}
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
      </div>

      {/* Code preview */}
      <pre className="p-2 rounded bg-muted/30 text-xs font-mono overflow-hidden max-h-20 mb-2">
        <code className={`language-${snippet.language}`}>
          {getPreview(snippet.code)}
        </code>
      </pre>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-muted">{snippet.language}</span>
          <span className="px-2 py-0.5 rounded bg-muted capitalize">{snippet.type}</span>
        </div>
        <div className="flex items-center gap-2">
          {snippet.useCount > 0 && (
            <span>{snippet.useCount} uses</span>
          )}
          <span>{formatDate(snippet.updatedAt)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ============== SNIPPET LIST COMPONENT ==============

interface SnippetListProps {
  snippets: Snippet[];
  onSnippetClick?: (snippet: Snippet) => void;
  onSnippetCopy?: (snippet: Snippet) => void;
  onSnippetDelete?: (snippet: Snippet) => void;
  onSnippetFavorite?: (snippet: Snippet) => void;
  onSnippetEdit?: (snippet: Snippet) => void;
  selectedId?: UUID | null;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function SnippetList({
  snippets,
  onSnippetClick,
  onSnippetCopy,
  onSnippetDelete,
  onSnippetFavorite,
  onSnippetEdit,
  selectedId,
  loading = false,
  emptyMessage = "No snippets",
  className,
}: SnippetListProps) {
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

  if (snippets.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <Code className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Split pinned and regular
  const pinnedSnippets = snippets.filter(s => s.isPinned);
  const regularSnippets = snippets.filter(s => !s.isPinned);

  return (
    <div className={cn("space-y-4", className)}>
      {pinnedSnippets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Pin className="w-3 h-3" /> Pinned
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {pinnedSnippets.map((snippet) => (
                <SnippetCard
                  key={snippet.id}
                  snippet={snippet}
                  onClick={() => onSnippetClick?.(snippet)}
                  onCopy={() => onSnippetCopy?.(snippet)}
                  onDelete={() => onSnippetDelete?.(snippet)}
                  onToggleFavorite={() => onSnippetFavorite?.(snippet)}
                  onEdit={() => onSnippetEdit?.(snippet)}
                  selected={selectedId === snippet.id}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {regularSnippets.length > 0 && (
        <div className="space-y-2">
          {pinnedSnippets.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground">Other Snippets</h3>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {regularSnippets.map((snippet) => (
                <SnippetCard
                  key={snippet.id}
                  snippet={snippet}
                  onClick={() => onSnippetClick?.(snippet)}
                  onCopy={() => onSnippetCopy?.(snippet)}
                  onDelete={() => onSnippetDelete?.(snippet)}
                  onToggleFavorite={() => onSnippetFavorite?.(snippet)}
                  onEdit={() => onSnippetEdit?.(snippet)}
                  selected={selectedId === snippet.id}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== SNIPPETS TAB COMPONENT ==============

interface SnippetsTabProps {
  projectId: UUID;
  snippets: Snippet[];
  folders: Folder[];
  onCreateSnippet: (title: string, code: string, type: SnippetType, language: string) => void;
  onUpdateSnippet: (snippetId: UUID, updates: Partial<Snippet>) => void;
  onDeleteSnippet: (snippetId: UUID) => void;
  onCopySnippet: (snippetId: UUID) => void;
  loading?: boolean;
  className?: string;
}

export function SnippetsTab({
  projectId: _projectId,
  snippets,
  folders: _folders,
  onCreateSnippet: _onCreateSnippet,
  onUpdateSnippet,
  onDeleteSnippet,
  onCopySnippet,
  loading = false,
  className,
}: SnippetsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SnippetType | "all">("all");
  const [languageFilter, setLanguageFilter] = useState<string | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  const filteredSnippets = useMemo(() => {
    let filtered = snippets;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query) ||
        s.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(s => s.type === typeFilter);
    }

    if (languageFilter !== "all") {
      filtered = filtered.filter(s => s.language === languageFilter);
    }

    return filtered;
  }, [snippets, searchQuery, typeFilter, languageFilter]);

  const availableLanguages = useMemo(() => {
    const langs = new Set(snippets.map(s => s.language));
    return Array.from(langs).sort();
  }, [snippets]);

  const types: SnippetType[] = ["code", "prompt", "template", "command", "markdown", "json", "shell", "sql"];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search snippets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as SnippetType | "all")}
            className="px-3 py-2 rounded-lg border text-sm"
          >
            <option value="all">All Types</option>
            {types.map((type) => (
              <option key={type} value={type} className="capitalize">
                {type}
              </option>
            ))}
          </select>

          {availableLanguages.length > 1 && (
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
            >
              <option value="all">All Languages</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Snippet
        </button>
      </div>

      {/* Snippet list */}
      <SnippetList
        snippets={filteredSnippets}
        onSnippetCopy={(snippet) => onCopySnippet(snippet.id)}
        onSnippetDelete={(snippet) => onDeleteSnippet(snippet.id)}
        onSnippetFavorite={(snippet) => onUpdateSnippet(snippet.id, { isFavorite: !snippet.isFavorite })}
        onSnippetEdit={(snippet) => setEditingSnippet(snippet)}
        loading={loading}
        emptyMessage={searchQuery ? "No snippets match your search" : "No snippets yet"}
      />

      {/* Create/Edit modal would go here */}
    </div>
  );
}
