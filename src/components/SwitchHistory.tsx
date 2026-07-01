/**
 * SwitchHistory — Displays the history of AI platform switches.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, ArrowRight, CircleCheck as CheckCircle, Circle as XCircle, Clock, RefreshCw, TriangleAlert as AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types/omni";
import type { SwitchHistoryEntry } from "@/engines/ai-switch";

interface SwitchHistoryProps {
  history: SwitchHistoryEntry[];
  onRetry?: (entry: SwitchHistoryEntry) => void;
  onClear?: () => void;
  maxItems?: number;
  className?: string;
}

const platformColors: Record<Platform, string> = {
  Claude: "bg-orange-500",
  ChatGPT: "bg-green-500",
  Gemini: "bg-blue-500",
  Grok: "bg-gray-700",
  Perplexity: "bg-teal-500",
  DeepSeek: "bg-indigo-500",
  "Microsoft Copilot": "bg-sky-500",
  "Google AI Studio": "bg-purple-500",
  Other: "bg-gray-500",
};

export function SwitchHistory({
  history,
  onRetry,
  onClear,
  maxItems = 20,
  className,
}: SwitchHistoryProps) {
  const displayHistory = history.slice(0, maxItems);

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

  const formatSize = (bytes: number) => {
    if (bytes < 1000) return `${bytes}B`;
    if (bytes < 1000000) return `${(bytes / 1000).toFixed(1)}KB`;
    return `${(bytes / 1000000).toFixed(1)}MB`;
  };

  if (history.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <History className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">No switch history yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Switch between AI platforms to see your history here
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <History className="w-4 h-4" />
          Switch History
        </h3>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        {/* Entries */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {displayHistory.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.05 }}
                className="relative pl-10"
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    "absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-background",
                    entry.status === "success" && "bg-green-500",
                    entry.status === "failed" && "bg-red-500",
                    entry.status === "cancelled" && "bg-gray-400"
                  )}
                />

                {/* Entry card */}
                <div className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    {/* Platform flow */}
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          platformColors[entry.sourcePlatform]
                        )}
                      />
                      <span className="text-sm font-medium">
                        {entry.sourcePlatform}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          platformColors[entry.targetPlatform]
                        )}
                      />
                      <span className="text-sm font-medium">
                        {entry.targetPlatform}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1">
                      {entry.status === "success" && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {entry.status === "failed" && (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      {entry.status === "cancelled" && (
                        <span className="text-xs text-muted-foreground">Cancelled</span>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(entry.timestamp)}
                    </span>
                    <span>
                      {formatSize(entry.transferSize)}
                    </span>
                    <span>
                      {entry.duration}ms
                    </span>
                  </div>

                  {/* Error message */}
                  {entry.status === "failed" && entry.error && (
                    <div className="mt-2 flex items-start gap-1 text-xs text-red-600">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {entry.error}
                    </div>
                  )}

                  {/* Retry button */}
                  {entry.status === "failed" && onRetry && (
                    <button
                      onClick={() => onRetry(entry)}
                      className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/**
 * SwitchStats — Displays statistics about platform switches.
 */

interface SwitchStatsProps {
  stats: {
    totalSwitches: number;
    successfulSwitches: number;
    failedSwitches: number;
    mostCommonSource: Platform | null;
    mostCommonTarget: Platform | null;
    averageDuration: number;
  };
  className?: string;
}

export function SwitchStats({ stats, className }: SwitchStatsProps) {
  const successRate =
    stats.totalSwitches > 0
      ? Math.round((stats.successfulSwitches / stats.totalSwitches) * 100)
      : 0;

  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      <div className="p-3 rounded-lg bg-muted/50 text-center">
        <div className="text-2xl font-bold">{stats.totalSwitches}</div>
        <div className="text-xs text-muted-foreground">Total Switches</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/50 text-center">
        <div className="text-2xl font-bold text-green-500">{successRate}%</div>
        <div className="text-xs text-muted-foreground">Success Rate</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/50 text-center">
        <div className="text-2xl font-bold">{Math.round(stats.averageDuration)}ms</div>
        <div className="text-xs text-muted-foreground">Avg Duration</div>
      </div>

      {stats.mostCommonSource && stats.mostCommonTarget && (
        <div className="col-span-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Most common:</span>
          <span className="font-medium">{stats.mostCommonSource}</span>
          <ArrowRight className="w-3 h-3" />
          <span className="font-medium">{stats.mostCommonTarget}</span>
        </div>
      )}
    </div>
  );
}
