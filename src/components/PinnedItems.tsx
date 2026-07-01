/**
 * Pinned Items — Unified pinned items widget for all workspace content.
 */

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, File, FileText, CircleCheck as CheckCircle2, Code, Link, MessageSquare, Folder, MoveVertical as MoreVertical, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UUID } from "@/types/omni";
import type { PinnedItem, PinnedItemType } from "../models/workspace";

// ============== PINNED ITEM TYPE ICONS ==============

interface PinnedItemTypeIconProps {
  itemType: PinnedItemType;
  className?: string;
  size?: number;
}

export function PinnedItemTypeIcon({ itemType, className, size = 16 }: PinnedItemTypeIconProps) {
  const icons: Record<PinnedItemType, React.ReactNode> = {
    file: <File className={cn("text-blue-500", className)} size={size} />,
    note: <FileText className={cn("text-purple-500", className)} size={size} />,
    task: <CheckCircle2 className={cn("text-green-500", className)} size={size} />,
    snippet: <Code className={cn("text-orange-500", className)} size={size} />,
    clipboard: <Link className={cn("text-teal-500", className)} size={size} />,
    message: <MessageSquare className={cn("text-yellow-500", className)} size={size} />,
    project: <Folder className={cn("text-indigo-500", className)} size={size} />,
  };

  return icons[itemType] || <Pin className={className} size={size} />;
}

// ============== PINNED ITEM CARD ==============

interface PinnedItemCardProps {
  pinnedItem: PinnedItem;
  itemTitle?: string;
  itemData?: {
    preview?: string;
    tags?: string[];
    date?: number;
  };
  onClick?: () => void;
  onUnpin?: () => void;
  compact?: boolean;
}

export function PinnedItemCard({
  pinnedItem,
  itemTitle,
  itemData,
  onClick,
  onUnpin,
  compact = false,
}: PinnedItemCardProps) {
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  if (compact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className={cn(
          "group flex items-center gap-2 p-2 rounded-lg transition-colors",
          onClick && "cursor-pointer hover:bg-muted/50"
        )}
        onClick={onClick}
      >
        <PinnedItemTypeIcon itemType={pinnedItem.itemType} size={14} />
        <span className="flex-1 truncate text-sm">{itemTitle || pinnedItem.itemType}</span>
        {onUnpin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnpin();
            }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
          >
            <PinOff className="w-3 h-3" />
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group relative p-3 rounded-lg border bg-background transition-all",
        onClick && "cursor-pointer hover:shadow-sm hover:border-primary/20"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <PinnedItemTypeIcon itemType={pinnedItem.itemType} />
          <span className="font-medium truncate text-sm">{itemTitle || pinnedItem.itemType}</span>
        </div>

        {onUnpin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnpin();
            }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
          >
            <Pin className="w-4 h-4 text-blue-500" />
          </button>
        )}
      </div>

      {/* Preview */}
      {itemData?.preview && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {itemData.preview}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="capitalize">{pinnedItem.itemType}</span>
        {itemData?.date && <span>{formatDate(itemData.date)}</span>}
      </div>
    </motion.div>
  );
}

// ============== PINNED ITEMS LIST ==============

interface PinnedItemsListProps {
  pinnedItems: PinnedItem[];
  itemDataMap?: Map<UUID, { title?: string; preview?: string; date?: number }>;
  onItemClick?: (item: PinnedItem) => void;
  onItemUnpin?: (item: PinnedItem) => void;
  loading?: boolean;
  emptyMessage?: string;
  compact?: boolean;
  groupByType?: boolean;
  className?: string;
}

export function PinnedItemsList({
  pinnedItems,
  itemDataMap,
  onItemClick,
  onItemUnpin,
  loading = false,
  emptyMessage = "No pinned items",
  compact = false,
  groupByType = false,
  className,
}: PinnedItemsListProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className={cn("rounded-lg bg-muted/30", compact ? "h-8" : "h-20")} />
          </div>
        ))}
      </div>
    );
  }

  if (pinnedItems.length === 0) {
    return (
      <div className={cn("text-center py-6", className)}>
        <Pin className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Group by type if requested
  if (groupByType) {
    const grouped = pinnedItems.reduce((acc, item) => {
      if (!acc[item.itemType]) acc[item.itemType] = [];
      acc[item.itemType].push(item);
      return acc;
    }, {} as Record<PinnedItemType, PinnedItem[]>);

    return (
      <div className={cn("space-y-4", className)}>
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 capitalize flex items-center gap-2">
              <PinnedItemTypeIcon itemType={type as PinnedItemType} size={12} />
              {type}s ({items.length})
            </h4>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <PinnedItemCard
                    key={item.id}
                    pinnedItem={item}
                    itemTitle={itemDataMap?.get(item.itemId)?.title}
                    itemData={{
                      preview: itemDataMap?.get(item.itemId)?.preview,
                      date: itemDataMap?.get(item.itemId)?.date,
                    }}
                    onClick={() => onItemClick?.(item)}
                    onUnpin={() => onItemUnpin?.(item)}
                    compact={compact}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <AnimatePresence mode="popLayout">
        {pinnedItems.map((item) => (
          <PinnedItemCard
            key={item.id}
            pinnedItem={item}
            itemTitle={itemDataMap?.get(item.itemId)?.title}
            itemData={{
              preview: itemDataMap?.get(item.itemId)?.preview,
              date: itemDataMap?.get(item.itemId)?.date,
            }}
            onClick={() => onItemClick?.(item)}
            onUnpin={() => onItemUnpin?.(item)}
            compact={compact}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============== PINNED ITEMS WIDGET ==============

interface PinnedItemsWidgetProps {
  projectId: UUID;
  pinnedItems: PinnedItem[];
  itemDataMap?: Map<UUID, { title?: string; preview?: string; date?: number }>;
  onItemClick?: (item: PinnedItem) => void;
  onItemUnpin?: (item: PinnedItem) => void;
  onViewAll?: () => void;
  maxItems?: number;
  loading?: boolean;
  className?: string;
}

export function PinnedItemsWidget({
  projectId: _projectId,
  pinnedItems,
  itemDataMap,
  onItemClick,
  onItemUnpin,
  onViewAll,
  maxItems = 5,
  loading = false,
  className,
}: PinnedItemsWidgetProps) {
  const displayItems = pinnedItems.slice(0, maxItems);

  return (
    <div className={cn("p-4 rounded-lg border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Pin className="w-4 h-4 text-blue-500" />
          Pinned
          {!loading && pinnedItems.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({pinnedItems.length})
            </span>
          )}
        </h3>
        {onViewAll && pinnedItems.length > maxItems && (
          <button
            onClick={onViewAll}
            className="text-xs text-primary hover:underline"
          >
            View all
          </button>
        )}
      </div>

      {/* Items */}
      <PinnedItemsList
        pinnedItems={displayItems}
        itemDataMap={itemDataMap}
        onItemClick={onItemClick}
        onItemUnpin={onItemUnpin}
        loading={loading}
        compact
      />
    </div>
  );
}
