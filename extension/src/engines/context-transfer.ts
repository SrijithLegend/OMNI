/**
 * Context Transfer Engine — Builds optimized packages for AI platform transfers.
 *
 * Responsibilities:
 * - Extract relevant context from conversations
 * - Compress to fit target models
 * - Prioritize critical information
 * - Format for specific platforms
 */

import { BaseEngine } from "./base";
import type { Platform, UUID } from "../types/omni";
import type {
  UniversalConversation,
  UniversalMessage,
  ContextPackage,
  ConversationSummary,
} from "../models/universal-conversation";
import { getModelCapabilities } from "./model-registry";
import { SummaryEngine } from "./summary";

export interface TransferPackageOptions {
  detailLevel: "short" | "medium" | "detailed";
  maxTokens?: number;
  includeCodeBlocks: boolean;
  includeRecentMessages: boolean;
  includeMetadata: boolean;
  prioritizedSections: string[];
}

export interface TransferStats {
  originalMessages: number;
  includedMessages: number;
  originalTokens: number;
  outputTokens: number;
  compressionRatio: number;
  truncatedSections: string[];
}

const DEFAULT_OPTIONS: TransferPackageOptions = {
  detailLevel: "medium",
  includeCodeBlocks: true,
  includeRecentMessages: true,
  includeMetadata: true,
  prioritizedSections: ["goals", "decisions", "open_questions"],
};

export class ContextTransferEngine extends BaseEngine {
  private summaryEngine: SummaryEngine;
  private cache: Map<string, { package: ContextPackage; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super({ name: "ContextTransferEngine", version: "1.0.0", debug: false });
    this.summaryEngine = new SummaryEngine();
  }

  async start(): Promise<void> {
    await this.summaryEngine.start();
    this.isRunning = true;
    this.log("info", "Context Transfer Engine started");
    this.emit("ready");
  }

  async stop(): Promise<void> {
    await this.summaryEngine.stop();
    this.cache.clear();
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: true,
      message: `Transfer engine ready (${this.cache.size} cached)`,
      timestamp: Date.now(),
    };
  }

  /**
   * Build a transfer package for a conversation.
   */
  async buildPackage(
    conversation: UniversalConversation,
    targetPlatform: Platform,
    projectId?: UUID | null,
    options: Partial<TransferPackageOptions> = {},
  ): Promise<{ pkg: ContextPackage; stats: TransferStats }> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const targetCaps = getModelCapabilities(targetPlatform);
    const maxTokens = opts.maxTokens || targetCaps.contextLimit;

    // Check cache
    const cacheKey = `${conversation.id}_${targetPlatform}_${opts.detailLevel}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.log("debug", "Using cached transfer package");
      return {
        pkg: cached.package,
        stats: {
          originalMessages: conversation.messages.length,
          includedMessages: conversation.messages.length,
          originalTokens: cached.package.tokenCount,
          outputTokens: cached.package.tokenCount,
          compressionRatio: 1,
          truncatedSections: [],
        },
      };
    }

    // Generate or use existing summary
    let summary = conversation.summary;
    if (!summary.short && !summary.medium && !summary.detailed) {
      this.log("debug", "Generating new summary");
      summary = await this.summaryEngine.generateSummary(conversation);
    }

    // Select relevant messages
    const { messages, truncatedSections } = this.selectMessages(
      conversation.messages,
      maxTokens,
      opts
    );

    // Select key exchanges
    const keyExchanges = this.selectKeyExchanges(conversation.messages);

    // Build formatted context
    const formattedContext = this.formatContext(
      conversation,
      summary,
      messages,
      keyExchanges,
      targetPlatform,
      opts
    );

    const pkg: ContextPackage = {
      conversationId: conversation.id,
      projectId: projectId || conversation.projectId,
      conversationContext: {
        summary,
        recentMessages: messages,
        keyExchanges,
        openQuestions: summary.questions.slice(0, 5),
      },
      formattedContext,
      generatedAt: Date.now(),
      tokenCount: this.estimateTokens(formattedContext),
      format: opts.detailLevel,
    };

    // Cache the result
    this.cache.set(cacheKey, { package: pkg, timestamp: Date.now() });

    const stats: TransferStats = {
      originalMessages: conversation.messages.length,
      includedMessages: messages.length,
      originalTokens: conversation.stats.totalTokens || 0,
      outputTokens: pkg.tokenCount,
      compressionRatio: pkg.tokenCount > 0
        ? (conversation.stats.totalTokens || pkg.tokenCount) / pkg.tokenCount
        : 1,
      truncatedSections,
    };

    return { pkg, stats };
  }

  /**
   * Build a minimal package for quick transfer.
   */
  async buildMinimalPackage(
    conversation: UniversalConversation,
    targetPlatform: Platform,
  ): Promise<ContextPackage> {
    const { pkg } = await this.buildPackage(conversation, targetPlatform, undefined, {
      detailLevel: "short",
      includeCodeBlocks: false,
      includeRecentMessages: false,
      maxTokens: 4000,
    });
    return pkg;
  }

  /**
   * Build a detailed package for full context.
   */
  async buildDetailedPackage(
    conversation: UniversalConversation,
    targetPlatform: Platform,
  ): Promise<ContextPackage> {
    const { pkg } = await this.buildPackage(conversation, targetPlatform, undefined, {
      detailLevel: "detailed",
      includeCodeBlocks: true,
      includeRecentMessages: true,
      maxTokens: getModelCapabilities(targetPlatform).contextLimit,
    });
    return pkg;
  }

  /**
   * Clear the transfer cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.emit("cache-cleared");
  }

  // Private methods

  private selectMessages(
    messages: UniversalMessage[],
    maxTokens: number,
    options: TransferPackageOptions,
  ): { messages: UniversalMessage[]; truncatedSections: string[] } {
    const truncatedSections: string[] = [];
    const selected: UniversalMessage[] = [];
    let currentTokens = 0;
    const maxChars = maxTokens * 4;

    // Always include the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      selected.unshift(lastUserMessage);
      currentTokens += this.estimateMessageTokens(lastUserMessage);
    }

    // Include recent assistant response
    const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistantMessage && currentTokens < maxChars) {
      selected.unshift(lastAssistantMessage);
      currentTokens += this.estimateMessageTokens(lastAssistantMessage);
    }

    // Build token budget for history
    const historyBudget = maxChars - currentTokens;

    if (options.includeRecentMessages && historyBudget > 0) {
      // Take messages from the end, respecting budget
      const remaining = messages.slice(0, -2); // Exclude last pair already added
      let historyChars = 0;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const msg = remaining[i];
        const msgChars = msg.content.length + 100; // overhead

        if (historyChars + msgChars > historyBudget) {
          truncatedSections.push("older message history");
          break;
        }

        selected.unshift(msg);
        historyChars += msgChars;
      }
    }

    // Check code blocks
    if (!options.includeCodeBlocks) {
      for (const msg of selected) {
        if (msg.codeBlocks.length > 0) {
          truncatedSections.push("code blocks");
          break;
        }
      }
    }

    return { messages: selected, truncatedSections };
  }

  private selectKeyExchanges(messages: UniversalMessage[]): UniversalMessage[] {
    const key: UniversalMessage[] = [];
    const seen = new Set<string>();

    for (const msg of messages) {
      // Skip duplicates
      const hash = `${msg.role}:${msg.content.slice(0, 100)}`;
      if (seen.has(hash)) continue;
      seen.add(hash);

      // Include messages with code
      if (msg.codeBlocks.length > 0) {
        key.push(msg);
        continue;
      }

      // Include messages with attachments
      if (msg.attachments.length > 0) {
        key.push(msg);
        continue;
      }

      // Include user messages that look important
      if (msg.role === "user") {
        const content = msg.content.toLowerCase();
        if (
          content.includes("important") ||
          content.includes("goal") ||
          content.includes("note:") ||
          content.includes("remember") ||
          content.includes("decision")
        ) {
          key.push(msg);
        }
      }
    }

    return key.slice(0, 10);
  }

  private formatContext(
    conversation: UniversalConversation,
    summary: ConversationSummary,
    messages: UniversalMessage[],
    keyExchanges: UniversalMessage[],
    _targetPlatform: Platform,
    options: TransferPackageOptions,
  ): string {
    const parts: string[] = [];

    // Header
    parts.push(`# Context for AI Transfer`);
    parts.push(`Source: ${conversation.platform} | Model: ${conversation.model}`);
    parts.push(`Date: ${new Date(conversation.createdAt).toISOString().split("T")[0]}`);
    parts.push("");

    // Summary section
    if (summary.short || summary.medium || summary.detailed) {
      parts.push(`## Summary`);
      if (options.detailLevel === "detailed" && summary.detailed) {
        parts.push(summary.detailed);
      } else if (options.detailLevel === "medium" && summary.medium) {
        parts.push(summary.medium);
      } else {
        parts.push(summary.short || summary.medium || summary.detailed);
      }
      parts.push("");
    }

    // Key goals and decisions
    if (summary.goals?.length > 0) {
      parts.push(`## Goals`);
      summary.goals.slice(0, options.detailLevel === "short" ? 3 : 5).forEach((g) => {
        parts.push(`- ${g}`);
      });
      parts.push("");
    }

    if (summary.decisions?.length > 0) {
      parts.push(`## Key Decisions`);
      summary.decisions.slice(0, options.detailLevel === "short" ? 3 : 5).forEach((d) => {
        parts.push(`- ${d}`);
      });
      parts.push("");
    }

    // Technologies
    if (summary.technologies?.length > 0) {
      parts.push(`## Technologies`);
      parts.push(summary.technologies.join(", "));
      parts.push("");
    }

    // Recent context
    if (options.includeRecentMessages && messages.length > 0) {
      parts.push(`## Recent Context`);
      parts.push("");

      for (const msg of messages) {
        const role = msg.role === "user" ? "**You**" : "**AI**";
        parts.push(`${role}:`);

        let content = msg.content;
        if (content.length > 1000 && options.detailLevel !== "detailed") {
          content = content.slice(0, 1000) + "...";
        }

        // Include code blocks if requested
        if (options.includeCodeBlocks && msg.codeBlocks.length > 0) {
          parts.push(content);
          for (const block of msg.codeBlocks) {
            parts.push(`\n\`\`\`${block.language}`);
            parts.push(block.code.slice(0, 500));
            parts.push("```\n");
          }
        } else {
          parts.push(content);
        }
        parts.push("");
      }
    }

    // Open questions
    if (summary.questions?.length > 0) {
      parts.push(`## Open Questions`);
      summary.questions.slice(0, 5).forEach((q, i) => {
        parts.push(`${i + 1}. ${q}`);
      });
      parts.push("");
    }

    return parts.join("\n");
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private estimateMessageTokens(msg: UniversalMessage): number {
    return this.estimateTokens(msg.content) + 100; // overhead for metadata
  }
}
