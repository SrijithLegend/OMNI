/**
 * Activity Feed — Displays recent activity across all workspace modules.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, FileText, File, CircleCheck as CheckCircle, Star, Pin, Trash2, CreditCard as Edit3, Eye, Download, Plus, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UUID } from "@/types/omni";
import type { ActivityItem, ActivityAction, ActivityItemType } from "../models/workspace";

// ============== ACTIVITY ICON ==============

interface ActivityIconProps {
  action: ActivityAction;
  itemType: ActivityItemType;
  className?: string;
}

export function ActivityIcon({ action, itemType, className }: ActivityIconProps) {
  const getActionIcon = () => {
    switch (action) {
      case "created":
        return <Plus className={cn("text-green-500", className)} size={16} />;
      case "updated":
        return <Edit3 className={cn("text-blue-500", className)} size={16} />;
      case "deleted":
        return <Trash2 className={cn("text-red-500", className)} size={16} />;
      case "completed":
        return <CheckCircle className={cn("text-green-500", className)} size={16} />;
      case "favorited":
        return <Star className={cn("text-yellow-500", className)} size={16} />;
      case "pinned":
        return <Pin className={cn("text-blue-500", className)} size={16} />;
      case "viewed":
        return <Eye className={cn("text-gray-500", className)} size={16} />;
      case "downloaded":
        return <Download className={cn("text-purple-500", className)} size={16} />;
      case "archived":
        return <Archive className={cn("text-slate-500", className)} size={16} />;
      default:
        return <Activity className={cn("text-gray-500", className)} size={16} />;
    }
  };

  const getItemTypeIcon = () => {
    switch (itemType) {
      case "file":
        return <File className={cn("text-muted-foreground", className)} size={12} />;
      case "note":
        return <FileText className={cn("text-muted-foreground", className)} size={12} />;
      case "task":
        return <CheckCircle className={cn("text-muted-foreground", className)} size={12} />;
      default:
        return <Activity className={cn("text-muted-foreground", className)} size={12} />;
    }
  };

  return (
    <div className="relative">
      {getActionIcon()}
      <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
        {getItemTypeIcon()}
      </div>
    </div>
  );
}

// ============== ACTIVITY CARD ==============

interface ActivityCardProps {
  activity: ActivityItem;
  onClick?: () => void;
  compact?: boolean;
}

export function ActivityCard({ activity, onClick, compact = false }: ActivityCardProps) {
  const formatTime = (timestamp: number) => {
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

  const formatAction = (action: ActivityAction): string => {
    const actionMap: Record<ActivityAction, string> = {
      created: "Created",
      updated: "Updated",
      deleted: "Deleted",
      viewed: "Viewed",
      downloaded: "Downloaded",
      completed: "Completed",
      favorited: "Favorited",
      unfavorited: "Unfavorited",
      pinned: "Pinned",
      unpinned: "Unpinned",
      restored: "Restored",
      archived: "Archived",
      moved: "Moved",
    };
    return actionMap[action] || action;
  };

  const formatItemType = (itemType: ActivityItemType): string => {
    return itemType.charAt(0).toUpperCase() + itemType.slice(1);
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center gap-2 py-1.5 text-xs cursor-default",
          onClick && "cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2"
        )}
        onClick={onClick}
      >
        <ActivityIcon action={activity.action} itemType={activity.itemType} />
        <span className="flex-1 truncate">
          <span className="font-medium">{formatAction(activity.action)}</span>
          <span className="text-muted-foreground"> {activity.title || formatItemType(activity.itemType)}</span>
        </span>
        <span className="text-muted-foreground">{formatTime(activity.createdAt)}</span>
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
        "flex items-start gap-3 p-3 rounded-lg border",
        onClick && "cursor-pointer hover:bg-muted/30"
      )}
      onClick={onClick}
    >
      <div className="mt-0.5">
        <ActivityIcon action={activity.action} itemType={activity.itemType} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{formatAction(activity.action)}</span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted capitalize">
            {activity.itemType}
          </span>
        </div>

        {activity.title && (
          <p className="text-sm text-muted-foreground truncate">{activity.title}</p>
        )}

        {activity.description && (
          <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
        )}
      </div>

      <span className="text-xs text-muted-foreground flex-shrink-0">
        {formatTime(activity.createdAt)}
      </span>
    </motion.div>
  );
}

// ============== ACTIVITY FEED COMPONENT ==============

interface ActivityFeedProps {
  activities: ActivityItem[];
  onItemClick?: (activity: ActivityItem) => void;
  loading?: boolean;
  emptyMessage?: string;
  compact?: boolean;
  maxItems?: number;
  showDateHeaders?: boolean;
  className?: string;
}

export function ActivityFeed({
  activities,
  onItemClick,
  loading = false,
  emptyMessage = "No recent activity",
  compact = false,
  maxItems,
  showDateHeaders = false,
  className,
}: ActivityFeedProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className={cn("rounded-lg bg-muted/30", compact ? "h-8" : "h-16")} />
          </div>
        ))}
      </div>
    );
  }

  const displayActivities = maxItems ? activities.slice(0, maxItems) : activities;

  if (displayActivities.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <Activity className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Group by date if showDateHeaders
  if (showDateHeaders && !compact) {
    const groupedByDate = displayActivities.reduce((acc, activity) => {
      const date = new Date(activity.createdAt).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    }, {} as Record<string, ActivityItem[]>);

    return (
      <div className={cn("space-y-4", className)}>
        {Object.entries(groupedByDate).map(([date, dateActivities]) => (
          <div key={date}>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
              {date === new Date().toDateString() ? "Today" : date}
            </h4>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {dateActivities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onClick={() => onItemClick?.(activity)}
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
        {displayActivities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onClick={() => onItemClick?.(activity)}
            compact={compact}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============== ACTIVITY SUMMARY WIDGET ==============

interface ActivitySummaryProps {
  stats: {
    total: number;
    today: number;
    thisWeek: number;
  };
  className?: string;
}

export function ActivitySummary({ stats, className }: ActivitySummaryProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-lg font-bold">{stats.today}</div>
        <div className="text-xs text-muted-foreground">Today</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-lg font-bold">{stats.thisWeek}</div>
        <div className="text-xs text-muted-foreground">Week</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-lg font-bold">{stats.total}</div>
        <div className="text-xs text-muted-foreground">Total</div>
      </div>
    </div>
  );
}
