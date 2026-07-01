/**
 * TransferPreviewModal — Preview and customize context before switching platforms.
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Loader as Loader2, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Copy, CreditCard as Edit3, FileText, MessageSquare, Target, Code, Link, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types/omni";
import type { ContextPackage } from "@/models/universal-conversation";
import type { SwitchPreview } from "@/engines/ai-switch";

interface TransferPreviewModalProps {
  isOpen: boolean;
  preview: SwitchPreview | null;
  onClose: () => void;
  onConfirm: () => void;
  onEditSummary?: () => void;
  onToggleSection?: (section: string) => void;
  className?: string;
}

export function TransferPreviewModal({
  isOpen,
  preview,
  onClose,
  onConfirm,
  onEditSummary,
  onToggleSection,
  className,
}: TransferPreviewModalProps) {
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [excludedSections, setExcludedSections] = useState<Set<string>>(new Set());

  // Calculate totals
  const includedCount = preview?.includedSections.length || 0;
  const excludedCount = preview?.excludedSections.length || 0;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSection = (section: string) => {
    setExcludedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
    onToggleSection?.(section);
  };

  if (!isOpen || !preview) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-background shadow-2xl",
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{preview.targetPlatform}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">AI Transfer</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 overflow-auto max-h-[60vh]">
            {/* Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Summary
                </h3>
                {onEditSummary && (
                  <button
                    onClick={() => {
                      setEditingSummary(!editingSummary);
                      setSummaryText(preview.summary);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </button>
                )}
              </div>
              {editingSummary ? (
                <textarea
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  className="w-full p-2 rounded-lg border text-sm resize-none"
                  rows={3}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{preview.summary}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Context Length</div>
                <div className="text-lg font-semibold">
                  {preview.contextLength.toLocaleString()}
                  <span className="text-xs text-muted-foreground ml-1">chars</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Estimated Tokens</div>
                <div className="text-lg font-semibold">
                  {preview.estimatedTokens.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
              <h3 className="font-medium">Context Sections</h3>

              {/* Included */}
              <div>
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Included ({includedCount})
                </div>
                <div className="flex flex-wrap gap-2">
                  {preview.includedSections.map((section) => (
                    <button
                      key={section}
                      onClick={() => handleToggleSection(section)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                        excludedSections.has(section)
                          ? "bg-muted text-muted-foreground line-through"
                          : "bg-green-500/10 text-green-600"
                      )}
                    >
                      {section}
                    </button>
                  ))}
                </div>
              </div>

              {/* Excluded */}
              {preview.excludedSections.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <X className="w-3 h-3 text-red-500" />
                    Excluded ({excludedCount})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {preview.excludedSections.map((section) => (
                      <span
                        key={section}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-muted text-muted-foreground"
                      >
                        {section}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 space-y-2">
                {preview.warnings.map((warning, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-yellow-600"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {/* Preview Context */}
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Preview Context
              </summary>
              <div className="mt-2 p-3 rounded-lg bg-muted/50 max-h-40 overflow-auto">
                <pre className="text-xs whitespace-pre-wrap">
                  {preview.contextPackage.formattedContext.slice(0, 500)}
                  {preview.contextPackage.formattedContext.length > 500 && "..."}
                </pre>
              </div>
            </details>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 p-4 border-t bg-muted/30">
            <button
              onClick={() => {
                navigator.clipboard.writeText(preview.contextPackage.formattedContext);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Context
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    Continue in {preview.targetPlatform}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
