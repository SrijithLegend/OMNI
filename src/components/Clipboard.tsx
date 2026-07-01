/**
 * Clipboard — Clipboard history UI components.
 */

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clipboard as ClipboardIcon, Copy, Trash2, Star, Pin, MoveVertical as MoreVertical, Search, Link, Code, FileText, Terminal, MessageSquare, Check, X, Clock, Shield, Settings, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UUID } from "@/types/omni";
import type { ClipboardItem, ClipboardContentType } from "@/models/workspace";

// ============== CLIPBOARD TYPE ICON ==============

interface ClipboardTypeIconProps {
  contentType: ClipboardContentType;
  className?: string;
  size?: number;
}

export function ClipboardTypeIcon({ contentType, className, size = 14 }: ClipboardTypeIconProps) {
  const icons: Record<ClipboardContentType, React.ReactNode> = {
    text: <FileText className={cn("text-gray-500", className)} size={size} />,
    code: <Code className={cn("text-blue-500", className)} size={size} />,
    link: <Link className={cn("text-purple-500", className)} size={size} />,
    path: <FileText className={cn("text-orange-500", className)} size={size} />,
    command: <Terminal className={cn("text-yellow-500", className)} size={size} />,
    prompt: <MessageSquare className={cn("text-green-500", className)} size={size} />,
  };

  return icons[contentType] || <FileText className={className} size={size} />;
}

// ============== CLIPBOARD ITEM CARD ==============

interface ClipboardItemCardProps {
  item: ClipboardItem;
  onCopy?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onTogglePinned?: () => void;
  copied?: boolean;
  compact?: boolean;
}

export function ClipboardItemCard({
  item,
  onCopy,
  onDelete,
  onToggleFavorite,
  onTogglePinned,
  copied = false,
  compact = false,
}: ClipboardItemCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const getPreview = (content: string, maxLength = 80) => {
    const cleaned = content.replace(/\n/g, " ").trim();
    return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + "..." : cleaned;
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy?.();
  };

  if (compact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className={cn(
          "group flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer hover:bg-muted/50",
          item.isSensitive && "opacity-60"
        )}
      >
        <ClipboardTypeIcon contentType={item.contentType} size={12} />
        <span className="flex-1 truncate text-xs">{getPreview(item.content, 50)}</span>
        <button
          onClick={handleCopy}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group relative p-3 rounded-lg border bg-background transition-all",
        "hover:shadow-sm",
        item.isPinned && "border-blue-500/30 bg-blue-500/5",
        item.isSensitive && "opacity-75"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardTypeIcon contentType={item.contentType} />
          <span className="text-xs text-muted-foreground capitalize">{item.contentType}</span>
          {item.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
          {item.isPinned && <Pin className="w-3 h-3 text-blue-500" />}
          {item.isSensitive && <Shield className="w-3 h-3 text-red-400" />}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatTime(item.createdAt)}</span>
        </div>
      </div>

      {/* Content preview */}
      <p className="text-sm line-clamp-2 mb-2 font-mono">
        {getPreview(item.content)}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {item.charCount} chars
          {item.copyCount > 1 && ` · ${item.copyCount} copies`}
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
                  {onToggleFavorite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onToggleFavorite();
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                    >
                      <Star className="w-4 h-4" />
                      {item.isFavorite ? "Unfavorite" : "Favorite"}
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
                      <Pin className="w-4 h-4" />
                      {item.isPinned ? "Unpin" : "Pin"}
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
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============== CLIPBOARD LIST COMPONENT ==============

interface ClipboardListProps {
  items: ClipboardItem[];
  onItemCopy?: (item: ClipboardItem) => void;
  onItemDelete?: (item: ClipboardItem) => void;
  onItemFavorite?: (item: ClipboardItem) => void;
  onItemPin?: (item: ClipboardItem) => void;
  copiedId?: UUID | null;
  loading?: boolean;
  emptyMessage?: string;
  compact?: boolean;
  className?: string;
}

export function ClipboardList({
  items,
  onItemCopy,
  onItemDelete,
  onItemFavorite,
  onItemPin,
  copiedId,
  loading = false,
  emptyMessage = "No clipboard history",
  compact = false,
  className,
}: ClipboardListProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse h-16 rounded-lg bg-muted/30" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <ClipboardIcon className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Split pinned and regular
  const pinnedItems = items.filter(i => i.isPinned);
  const regularItems = items.filter(i => !i.isPinned);

  return (
    <div className={cn("space-y-3", className)}>
      {pinnedItems.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Pin className="w-3 h-3" /> Pinned
          </h4>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {pinnedItems.map((item) => (
                <ClipboardItemCard
                  key={item.id}
                  item={item}
                  onCopy={() => onItemCopy?.(item)}
                  onDelete={() => onItemDelete?.(item)}
                  onToggleFavorite={() => onItemFavorite?.(item)}
                  onTogglePinned={() => onItemPin?.(item)}
                  copied={copiedId === item.id}
                  compact={compact}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {regularItems.length > 0 && (
        <div>
          {pinnedItems.length > 0 && (
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Recent</h4>
          )}
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {regularItems.map((item) => (
                <ClipboardItemCard
                  key={item.id}
                  item={item}
                  onCopy={() => onItemCopy?.(item)}
                  onDelete={() => onItemDelete?.(item)}
                  onToggleFavorite={() => onItemFavorite?.(item)}
                  onTogglePinned={() => onItemPin?.(item)}
                  copied={copiedId === item.id}
                  compact={compact}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== CLIPBOARD TAB COMPONENT ==============

interface ClipboardTabProps {
  items: ClipboardItem[];
  onItemCopy: (itemId: UUID) => void;
  onItemDelete: (itemId: UUID) => void;
  onItemFavorite: (itemId: UUID) => void;
  onItemPin: (itemId: UUID) => void;
  onClearHistory?: () => void;
  onToggleEnabled?: () => void;
  isEnabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function ClipboardTab({
  items,
  onItemCopy,
  onItemDelete,
  onItemFavorite,
  onItemPin,
  onClearHistory,
  onToggleEnabled,
  isEnabled = true,
  loading = false,
  className,
}: ClipboardTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ClipboardContentType | "all">("all");
  const [copiedId, setCopiedId] = useState<UUID | null>(null);

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(i => i.content.toLowerCase().includes(query));
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(i => i.contentType === typeFilter);
    }

    return filtered;
  }, [items, searchQuery, typeFilter]);

  const handleCopy = useCallback((item: ClipboardItem) => {
    onItemCopy(item.id);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, [onItemCopy]);

  const types: (ClipboardContentType | "all")[] = ["all", "text", "code", "link", "path", "command", "prompt"];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search clipboard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ClipboardContentType | "all")}
            className="px-3 py-2 rounded-lg border text-sm"
          >
            {types.map((type) => (
              <option key={type} value={type} className="capitalize">
                {type === "all" ? "All Types" : type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {onToggleEnabled && (
            <button
              onClick={onToggleEnabled}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                isEnabled ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
              )}
            >
              <Power className="w-4 h-4" />
              {isEnabled ? "On" : "Off"}
            </button>
          )}
          {onClearHistory && (
            <button
              onClick={onClearHistory}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Clipboard list */}
      <ClipboardList
        items={filteredItems}
        onItemCopy={handleCopy}
        onItemDelete={(item) => onItemDelete(item.id)}
        onItemFavorite={(item) => onItemFavorite(item.id)}
        onItemPin={(item) => onItemPin(item.id)}
        copiedId={copiedId}
        loading={loading}
        emptyMessage={searchQuery ? "No matches" : "No clipboard history"}
      />
    </div>
  );
}
