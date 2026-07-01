/**
 * SwitchToPlatformButton — Button to switch to another AI platform.
 */

import React from "react";
import { motion } from "framer-motion";
import { Loader as Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types/omni";

interface SwitchToPlatformButtonProps {
  platform: Platform;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const platformStyles: Record<Platform, { bg: string; text: string; border: string }> = {
  Claude: { bg: "bg-orange-500 hover:bg-orange-600", text: "text-white", border: "border-orange-600" },
  ChatGPT: { bg: "bg-green-500 hover:bg-green-600", text: "text-white", border: "border-green-600" },
  Gemini: { bg: "bg-blue-500 hover:bg-blue-600", text: "text-white", border: "border-blue-600" },
  Grok: { bg: "bg-gray-700 hover:bg-gray-800", text: "text-white", border: "border-gray-800" },
  Perplexity: { bg: "bg-teal-500 hover:bg-teal-600", text: "text-white", border: "border-teal-600" },
  DeepSeek: { bg: "bg-indigo-500 hover:bg-indigo-600", text: "text-white", border: "border-indigo-600" },
  "Microsoft Copilot": { bg: "bg-sky-500 hover:bg-sky-600", text: "text-white", border: "border-sky-600" },
  "Google AI Studio": { bg: "bg-purple-500 hover:bg-purple-600", text: "text-white", border: "border-purple-600" },
  Other: { bg: "bg-gray-500 hover:bg-gray-600", text: "text-white", border: "border-gray-600" },
};

export function SwitchToPlatformButton({
  platform,
  disabled = false,
  loading = false,
  onClick,
  className,
}: SwitchToPlatformButtonProps) {
  const styles = platformStyles[platform] || platformStyles.Other;

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
        styles.bg,
        styles.text,
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : null}
      <span>Continue in {platform}</span>
    </motion.button>
  );
}

/**
 * SwitchToPlatformDropdown — Dropdown with all available platforms.
 */

interface SwitchToPlatformDropdownProps {
  currentPlatform: Platform;
  onSelect: (platform: Platform) => void;
  disabled?: boolean;
  className?: string;
}

export function SwitchToPlatformDropdown({
  currentPlatform,
  onSelect,
  disabled = false,
  className,
}: SwitchToPlatformDropdownProps) {
  const [open, setOpen] = React.useState(false);

  const platforms: Platform[] = ["Claude", "ChatGPT", "Gemini", "Grok"];
  const availablePlatforms = platforms.filter((p) => p !== currentPlatform);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
          "hover:bg-muted",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span>Switch To</span>
        <svg
          className={cn("w-4 h-4 transition-transform", open && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-48 rounded-lg border bg-background shadow-lg z-20 overflow-hidden"
          >
            {availablePlatforms.map((platform) => {
              const styles = platformStyles[platform];
              return (
                <button
                  key={platform}
                  onClick={() => {
                    onSelect(platform);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    "hover:bg-muted text-left"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", styles.bg)} />
                  {platform}
                </button>
              );
            })}
          </motion.div>
        </>
      )}
    </div>
  );
}

/**
 * SwitchStatusBadge — Shows the current switch status.
 */

interface SwitchStatusBadgeProps {
  status: "idle" | "preparing" | "opening" | "ready" | "completed" | "error";
  className?: string;
}

export function SwitchStatusBadge({ status, className }: SwitchStatusBadgeProps) {
  const statusConfig = {
    idle: { color: "bg-gray-500", text: "Ready" },
    preparing: { color: "bg-yellow-500", text: "Preparing Context" },
    opening: { color: "bg-blue-500", text: "Opening Platform" },
    ready: { color: "bg-green-500", text: "Transfer Ready" },
    completed: { color: "bg-green-500", text: "Completed" },
    error: { color: "bg-red-500", text: "Error" },
  };

  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-white",
        config.color,
        className
      )}
    >
      {(status === "preparing" || status === "opening") && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
      {config.text}
    </span>
  );
}
