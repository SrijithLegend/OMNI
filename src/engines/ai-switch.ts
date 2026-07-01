/**
 * AI Switch Engine — Manages seamless switching between AI platforms.
 *
 * Responsibilities:
 * - Detect current platform
 * - Validate destination platform
 * - Build transfer package
 * - Open destination AI
 * - Deliver prepared context
 * - Track switch history
 * - Handle failures gracefully
 */

import { BaseEngine, type HealthStatus } from "./base";
import type { Platform, UUID } from "../types/omni";
import type {
  UniversalConversation,
  ContextPackage,
} from "../models/universal-conversation";
import { getModelCapabilities, getSupportedPlatforms } from "./model-registry";
import type { ModelRecommendation } from "./model-registry";

export interface SwitchConfig {
  openIn: "current_tab" | "new_tab" | "new_window";
  showPreview: boolean;
  autoCompress: boolean;
  defaultDetailLevel: "short" | "medium" | "detailed";
  clipboardFallback: boolean;
  trackHistory: boolean;
}

export interface SwitchRequest {
  sourcePlatform: Platform;
  targetPlatform: Platform;
  conversationId: UUID;
  projectId: UUID | null;
  contextPackage: ContextPackage;
  reason?: string;
}

export interface SwitchResult {
  success: boolean;
  switchId: string;
  sourcePlatform: Platform;
  targetPlatform: Platform;
  contextPackage: ContextPackage;
  tabId?: number;
  error?: string;
  timestamp: number;
}

export interface SwitchHistoryEntry {
  id: string;
  sourcePlatform: Platform;
  targetPlatform: Platform;
  conversationId: UUID;
  projectId: UUID | null;
  contextSize: number;
  transferSize: number;
  status: "success" | "failed" | "cancelled";
  error?: string;
  timestamp: number;
  duration: number; // ms
}

export interface SwitchPreview {
  targetPlatform: Platform;
  contextPackage: ContextPackage;
  summary: string;
  contextLength: number;
  includedSections: string[];
  excludedSections: string[];
  estimatedTokens: number;
  warnings: string[];
}

const DEFAULT_SWITCH_CONFIG: SwitchConfig = {
  openIn: "new_tab",
  showPreview: true,
  autoCompress: true,
  defaultDetailLevel: "medium",
  clipboardFallback: true,
  trackHistory: true,
};

// Platform URLs for opening
const PLATFORM_URLS: Record<Platform, string> = {
  Claude: "https://claude.ai/new",
  ChatGPT: "https://chatgpt.com/",
  Gemini: "https://gemini.google.com/app",
  Grok: "https://x.ai/grok",
  Perplexity: "https://www.perplexity.ai/",
  DeepSeek: "https://chat.deepseek.com/",
  "Microsoft Copilot": "https://copilot.microsoft.com/",
  "Google AI Studio": "https://aistudio.google.com/",
  Other: "",
};

export class AISwitchEngine extends BaseEngine {
  private config: SwitchConfig;
  private switchHistory: SwitchHistoryEntry[] = [];
  private pendingSwitch: SwitchRequest | null = null;

  constructor(config: Partial<SwitchConfig> = {}) {
    super({ name: "AISwitchEngine", version: "1.0.0", debug: false });
    this.config = { ...DEFAULT_SWITCH_CONFIG, ...config };
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.log("info", "AI Switch Engine started");
    this.emit("ready");
  }

  async stop(): Promise<void> {
    this.pendingSwitch = null;
    this.isRunning = false;
  }

  async health(): Promise<HealthStatus> {
    return {
      ok: true,
      message: `AI Switch: ${this.switchHistory.length} switches recorded`,
      timestamp: Date.now(),
    };
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<SwitchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get valid destination platforms for a switch.
   */
  getValidDestinations(sourcePlatform: Platform): Platform[] {
    return getSupportedPlatforms().filter((p) => p !== sourcePlatform);
  }

  /**
   * Validate a switch request.
   */
  validateSwitch(
    sourcePlatform: Platform,
    targetPlatform: Platform,
  ): { valid: boolean; error?: string } {
    if (sourcePlatform === targetPlatform) {
      return { valid: false, error: "Cannot switch to the same platform" };
    }

    const sourceCaps = getModelCapabilities(sourcePlatform);
    const targetCaps = getModelCapabilities(targetPlatform);

    if (!sourceCaps || sourceCaps.platform === "Other") {
      return { valid: false, error: "Unknown source platform" };
    }

    if (!targetCaps || targetCaps.platform === "Other") {
      return { valid: false, error: "Unknown target platform" };
    }

    return { valid: true };
  }

  /**
   * Prepare a switch preview.
   */
  preparePreview(
    contextPackage: ContextPackage,
    targetPlatform: Platform,
  ): SwitchPreview {
    const targetCaps = getModelCapabilities(targetPlatform);
    const includedSections: string[] = [];
    const excludedSections: string[] = [];
    const warnings: string[] = [];

    // Determine what to include based on target capabilities
    const context = contextPackage.conversationContext;

    if (context.summary.short) includedSections.push("Summary");
    if (context.keyExchanges.length > 0) includedSections.push("Key Exchanges");
    if (context.openQuestions.length > 0) includedSections.push("Questions");

    if (contextPackage.projectContext) {
      includedSections.push("Project Context");
    }

    // Check context limits
    if (contextPackage.tokenCount > targetCaps.contextLimit) {
      warnings.push(
        `Context may exceed ${targetCaps.modelName}'s limit of ${targetCaps.contextLimit} tokens`
      );
      excludedSections.push("Some message history");
    }

    // Check capabilities
    if (!targetCaps.supportsImages) {
      excludedSections.push("Images");
      warnings.push("Target does not support images");
    }

    if (!targetCaps.supportsFiles) {
      excludedSections.push("Files");
    }

    // Generate summary
    const summary = this.generateSwitchSummary(contextPackage, targetPlatform);

    return {
      targetPlatform,
      contextPackage,
      summary,
      contextLength: contextPackage.formattedContext.length,
      includedSections,
      excludedSections,
      estimatedTokens: contextPackage.tokenCount,
      warnings,
    };
  }

  /**
   * Execute a switch to another platform.
   */
  async executeSwitch(request: SwitchRequest): Promise<SwitchResult> {
    const startTime = Date.now();
    const switchId = crypto.randomUUID();

    this.log("info", `Starting switch: ${request.sourcePlatform} → ${request.targetPlatform}`);

    // Validate
    const validation = this.validateSwitch(
      request.sourcePlatform,
      request.targetPlatform
    );
    if (!validation.valid) {
      this.recordSwitch({
        id: switchId,
        sourcePlatform: request.sourcePlatform,
        targetPlatform: request.targetPlatform,
        conversationId: request.conversationId,
        projectId: request.projectId,
        contextSize: request.contextPackage.tokenCount,
        transferSize: request.contextPackage.formattedContext.length,
        status: "failed",
        error: validation.error,
        timestamp: startTime,
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        switchId,
        sourcePlatform: request.sourcePlatform,
        targetPlatform: request.targetPlatform,
        contextPackage: request.contextPackage,
        error: validation.error,
        timestamp: startTime,
      };
    }

    this.pendingSwitch = request;
    this.emit("switch-started", { switchId, request });

    try {
      // Prepare context for target
      const preparedContext = this.prepareContextForTarget(
        request.contextPackage,
        request.targetPlatform
      );

      // Open target platform
      const url = PLATFORM_URLS[request.targetPlatform];
      if (!url) {
        throw new Error(`Unknown URL for platform: ${request.targetPlatform}`);
      }

      let tabId: number | undefined;

      // Open based on config
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const tab = await this.openPlatform(url, request.targetPlatform);
        tabId = tab?.id;

        // Store context for delivery
        if (tabId) {
          await this.storePendingContext(tabId, preparedContext, request);
        }
      }

      // Copy to clipboard as backup
      if (this.config.clipboardFallback) {
        await this.copyToClipboard(preparedContext.formattedContext);
      }

      const duration = Date.now() - startTime;

      // Record success
      this.recordSwitch({
        id: switchId,
        sourcePlatform: request.sourcePlatform,
        targetPlatform: request.targetPlatform,
        conversationId: request.conversationId,
        projectId: request.projectId,
        contextSize: request.contextPackage.tokenCount,
        transferSize: preparedContext.formattedContext.length,
        status: "success",
        timestamp: startTime,
        duration,
      });

      this.emit("switch-completed", { switchId, result: { success: true, tabId } });

      return {
        success: true,
        switchId,
        sourcePlatform: request.sourcePlatform,
        targetPlatform: request.targetPlatform,
        contextPackage: preparedContext,
        tabId,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.recordSwitch({
        id: switchId,
        sourcePlatform: request.sourcePlatform,
        targetPlatform: request.targetPlatform,
        conversationId: request.conversationId,
        projectId: request.projectId,
        contextSize: request.contextPackage.tokenCount,
        transferSize: 0,
        status: "failed",
        error: errorMessage,
        timestamp: startTime,
        duration: Date.now() - startTime,
      });

      this.emit("switch-failed", { switchId, error: errorMessage });

      return {
        success: false,
        switchId,
        sourcePlatform: request.sourcePlatform,
        targetPlatform: request.targetPlatform,
        contextPackage: request.contextPackage,
        error: errorMessage,
        timestamp: Date.now(),
      };
    } finally {
      this.pendingSwitch = null;
    }
  }

  /**
   * Cancel a pending switch.
   */
  cancelSwitch(): void {
    if (this.pendingSwitch) {
      this.emit("switch-cancelled", { switchId: crypto.randomUUID() });
      this.pendingSwitch = null;
    }
  }

  /**
   * Get switch history.
   */
  getHistory(limit = 50): SwitchHistoryEntry[] {
    return this.switchHistory.slice(0, limit);
  }

  /**
   * Get switch statistics.
   */
  getStats(): {
    totalSwitches: number;
    successfulSwitches: number;
    failedSwitches: number;
    mostCommonSource: Platform | null;
    mostCommonTarget: Platform | null;
    averageDuration: number;
  } {
    const successful = this.switchHistory.filter((s) => s.status === "success");
    const failed = this.switchHistory.filter((s) => s.status === "failed");

    // Count sources and targets
    const sourceCounts = new Map<Platform, number>();
    const targetCounts = new Map<Platform, number>();

    for (const entry of this.switchHistory) {
      sourceCounts.set(entry.sourcePlatform, (sourceCounts.get(entry.sourcePlatform) || 0) + 1);
      targetCounts.set(entry.targetPlatform, (targetCounts.get(entry.targetPlatform) || 0) + 1);
    }

    let mostCommonSource: Platform | null = null;
    let maxSource = 0;
    for (const [platform, count] of sourceCounts) {
      if (count > maxSource) {
        maxSource = count;
        mostCommonSource = platform;
      }
    }

    let mostCommonTarget: Platform | null = null;
    let maxTarget = 0;
    for (const [platform, count] of targetCounts) {
      if (count > maxTarget) {
        maxTarget = count;
        mostCommonTarget = platform;
      }
    }

    const avgDuration = this.switchHistory.length > 0
      ? this.switchHistory.reduce((sum, s) => sum + s.duration, 0) / this.switchHistory.length
      : 0;

    return {
      totalSwitches: this.switchHistory.length,
      successfulSwitches: successful.length,
      failedSwitches: failed.length,
      mostCommonSource,
      mostCommonTarget,
      averageDuration: avgDuration,
    };
  }

  /**
   * Clear switch history.
   */
  clearHistory(): void {
    this.switchHistory = [];
    this.emit("history-cleared");
  }

  // Private methods

  private generateSwitchSummary(
    contextPackage: ContextPackage,
    targetPlatform: Platform
  ): string {
    const parts: string[] = [];

    if (contextPackage.projectContext) {
      parts.push(`Project: ${contextPackage.projectContext.name}`);
    }

    const summary = contextPackage.conversationContext.summary;
    if (summary.short) {
      parts.push(summary.short);
    }

    const targetCaps = getModelCapabilities(targetPlatform);
    parts.push(`Continuing in ${targetCaps.modelName}`);

    return parts.join(" | ");
  }

  private prepareContextForTarget(
    contextPackage: ContextPackage,
    targetPlatform: Platform
  ): ContextPackage {
    const targetCaps = getModelCapabilities(targetPlatform);

    // Check if we need compression
    let context = contextPackage.formattedContext;

    if (contextPackage.tokenCount > targetCaps.contextLimit && this.config.autoCompress) {
      this.log("info", `Compressing context for ${targetPlatform}`);
      context = this.compressContext(contextPackage, targetCaps.contextLimit);
    }

    return {
      ...contextPackage,
      formattedContext: context,
      tokenCount: Math.ceil(context.length / 4),
    };
  }

  private compressContext(
    contextPackage: ContextPackage,
    maxTokens: number
  ): string {
    // Compression prioritizes: goals > decisions > recent messages > history
    const parts: string[] = [];
    const maxChars = maxTokens * 4; // Rough estimate

    const summary = contextPackage.conversationContext.summary;

    // Always include summary
    if (summary.short) {
      parts.push(`# Summary\n${summary.short}`);
    }

    // Include key goals and decisions
    if (summary.goals?.length > 0) {
      parts.push(`# Goals\n${summary.goals.slice(0, 5).join("\n")}`);
    }

    if (summary.decisions?.length > 0) {
      parts.push(`# Key Decisions\n${summary.decisions.slice(0, 5).join("\n")}`);
    }

    // Include recent context if space allows
    const currentLength = parts.join("\n").length;
    const remainingChars = maxChars - currentLength - 500; // buffer

    if (remainingChars > 0 && contextPackage.conversationContext.recentMessages?.length > 0) {
      const recentContext = contextPackage.conversationContext.recentMessages
        .slice(-3)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n\n");

      parts.push(`# Recent Context\n${recentContext.slice(0, remainingChars)}`);
    }

    return parts.join("\n\n");
  }

  private async openPlatform(
    url: string,
    _platform: Platform
  ): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === "undefined" || !chrome.tabs) {
      // Fallback for non-extension environment
      window.open(url, "_blank");
      return null;
    }

    switch (this.config.openIn) {
      case "current_tab":
        await chrome.tabs.update({ url });
        return (await chrome.tabs.getCurrent()) ?? null;

      case "new_tab":
        return await chrome.tabs.create({ url });

      case "new_window":
        const window = await chrome.windows.create({ url, focused: true });
        return window.tabs?.[0] || null;

      default:
        return await chrome.tabs.create({ url });
    }
  }

  private async storePendingContext(
    tabId: number,
    contextPackage: ContextPackage,
    request: SwitchRequest
  ): Promise<void> {
    // Store in chrome.storage for content script to pick up
    if (typeof chrome !== "undefined" && chrome.storage) {
      await chrome.storage.local.set({
        [`omni_pending_transfer_${tabId}`]: {
          contextPackage,
          request,
          timestamp: Date.now(),
        },
      });

      // Set expiration (5 minutes)
      setTimeout(async () => {
        await chrome.storage.local.remove(`omni_pending_transfer_${tabId}`);
      }, 5 * 60 * 1000);
    }
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.emit("clipboard-updated", { length: text.length });
    } catch {
      this.log("warn", "Failed to copy to clipboard");
    }
  }

  private recordSwitch(entry: SwitchHistoryEntry): void {
    if (this.config.trackHistory) {
      this.switchHistory.unshift(entry);
      // Keep last 100 entries
      if (this.switchHistory.length > 100) {
        this.switchHistory = this.switchHistory.slice(0, 100);
      }
      this.emit("history-updated", { entry });
    }
  }
}
