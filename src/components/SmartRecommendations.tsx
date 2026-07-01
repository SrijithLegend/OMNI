/**
 * SmartRecommendations — Provides intelligent platform recommendations.
 */

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types/omni";
import type { ModelRecommendation } from "@/engines/model-registry";

interface SmartRecommendationsProps {
  recommendations: ModelRecommendation[];
  currentPlatform: Platform;
  onSelect: (platform: Platform) => void;
  context: {
    hasCode: boolean;
    codeLines: number;
    isResearch: boolean;
    isCreative: boolean;
    contextSize: number;
  };
  className?: string;
}

export function SmartRecommendations({
  recommendations,
  currentPlatform,
  onSelect,
  context,
  className,
}: SmartRecommendationsProps) {
  // Get top recommendation
  const topRecommendation = recommendations[0];

  // Determine context type label
  const getContextTypeLabel = () => {
    if (context.hasCode && context.codeLines > 100) return "Large coding project";
    if (context.hasCode) return "Coding task";
    if (context.isResearch) return "Research project";
    if (context.isCreative) return "Creative task";
    return "General task";
  };

  if (recommendations.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Context analysis */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="w-4 h-4 text-yellow-500" />
        <span>
          Detected: <strong className="text-foreground">{getContextTypeLabel()}</strong>
        </span>
      </div>

      {/* Top recommendation with explanation */}
      {topRecommendation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-primary/20 bg-primary/5"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">Recommended:</span>
                <span className="font-bold text-lg">{topRecommendation.platform}</span>
                <span className="text-xs text-muted-foreground">
                  ({topRecommendation.score}% match)
                </span>
              </div>

              {/* Reasons */}
              {topRecommendation.reasons.length > 0 && (
                <div className="space-y-1 mb-3">
                  {topRecommendation.reasons.map((reason, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      {reason}
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {topRecommendation.warnings && topRecommendation.warnings.length > 0 && (
                <div className="space-y-1">
                  {topRecommendation.warnings.map((warning, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-xs text-yellow-600"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => onSelect(topRecommendation.platform)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Switch
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Other options */}
      {recommendations.length > 1 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Other options:</div>
          <div className="flex flex-wrap gap-2">
            {recommendations.slice(1, 4).map((rec) => (
              <button
                key={rec.platform}
                onClick={() => onSelect(rec.platform)}
                disabled={rec.platform === currentPlatform}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors",
                  rec.platform === currentPlatform
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-muted"
                )}
              >
                <span>{rec.platform}</span>
                <span className="text-xs text-muted-foreground">
                  {rec.score}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * RecommendationContext - Context analysis component.
 */

interface RecommendationContextAnalysisProps {
  context: {
    hasCode: boolean;
    codeLines: number;
    isResearch: boolean;
    isCreative: boolean;
    isQuickTask: boolean;
    contextSize: number;
    hasImages: boolean;
    hasFiles: boolean;
  };
  className?: string;
}

export function RecommendationContextAnalysis({
  context,
  className,
}: RecommendationContextAnalysisProps) {
  const items: { label: string; value: string | boolean; icon: React.ReactNode }[] = [
    {
      label: "Code",
      value: context.hasCode ? `${context.codeLines} lines` : false,
      icon: <TrendingUp className="w-3 h-3" />,
    },
    {
      label: "Research",
      value: context.isResearch,
      icon: <Sparkles className="w-3 h-3" />,
    },
    {
      label: "Creative",
      value: context.isCreative,
      icon: <Sparkles className="w-3 h-3" />,
    },
    {
      label: "Quick Task",
      value: context.isQuickTask,
      icon: <TrendingUp className="w-3 h-3" />,
    },
    {
      label: "Context Size",
      value: `${Math.round(context.contextSize / 1000)}k chars`,
      icon: <TrendingUp className="w-3 h-3" />,
    },
  ];

  return (
    <div className={cn("flex flex-wrap gap-3 text-xs", className)}>
      {items
        .filter((item) => item.value)
        .map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-1 text-muted-foreground"
          >
            {item.icon}
            <span>{item.label}:</span>
            <span className="font-medium text-foreground">
              {typeof item.value === "boolean" ? "Yes" : item.value}
            </span>
          </div>
        ))}
    </div>
  );
}
