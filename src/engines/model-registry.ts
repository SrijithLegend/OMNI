/**
 * Model Capabilities Registry — Describes each AI model's strengths and characteristics.
 *
 * This registry helps make smart recommendations and informs context optimization.
 */

import type { Platform } from "../types/omni";

export interface ModelCapabilities {
  platform: Platform;
  modelName: string;
  strengths: string[];
  bestFor: string[];
  contextLimit: number; // tokens
  supportsImages: boolean;
  supportsFiles: boolean;
  supportsCodeInterpreter: boolean;
  supportsWebSearch: boolean;
  responseStyle: "concise" | "detailed" | "balanced";
  reasoningAbility: "basic" | "advanced" | "expert";
  codingAbility: "basic" | "advanced" | "expert";
  writingAbility: "basic" | "advanced" | "expert";
  analysisAbility: "basic" | "advanced" | "expert";
  recommendedFor: string[];
  notRecommendedFor: string[];
}

export interface ModelRecommendation {
  platform: Platform;
  score: number; // 0-100
  reasons: string[];
  warnings?: string[];
}

// Registry of all supported AI models
export const MODEL_REGISTRY: Record<Platform, ModelCapabilities> = {
  Claude: {
    platform: "Claude",
    modelName: "Claude 3.5 Sonnet",
    strengths: [
      "Complex coding tasks",
      "Architecture and system design",
      "Long-form technical writing",
      "Nuanced reasoning",
      "Following detailed instructions",
      "Chain-of-thought analysis",
    ],
    bestFor: [
      "Software development projects",
      "Code review and debugging",
      "Technical documentation",
      "API design",
      "Refactoring",
      "Test generation",
    ],
    contextLimit: 200000,
    supportsImages: true,
    supportsFiles: true,
    supportsCodeInterpreter: false,
    supportsWebSearch: false,
    responseStyle: "detailed",
    reasoningAbility: "expert",
    codingAbility: "expert",
    writingAbility: "expert",
    analysisAbility: "expert",
    recommendedFor: [
      "Large coding projects",
      "System architecture",
      "Complex debugging",
      "Technical specifications",
    ],
    notRecommendedFor: [
      "Real-time web search",
      "Quick casual brainstorming",
    ],
  },

  ChatGPT: {
    platform: "ChatGPT",
    modelName: "GPT-4o",
    strengths: [
      "General reasoning",
      "Creative writing",
      "Markdown formatting",
      "Data analysis",
      "Image understanding",
      "Code generation",
      "Web search integration",
    ],
    bestFor: [
      "Content creation",
      "Brainstorming",
      "General Q&A",
      "Code assistance",
      "Research",
      "Marketing copy",
    ],
    contextLimit: 128000,
    supportsImages: true,
    supportsFiles: true,
    supportsCodeInterpreter: true,
    supportsWebSearch: true,
    responseStyle: "balanced",
    reasoningAbility: "expert",
    codingAbility: "advanced",
    writingAbility: "expert",
    analysisAbility: "expert",
    recommendedFor: [
      "Content writing",
      "Marketing",
      "Research",
      "Data analysis",
      "General development",
    ],
    notRecommendedFor: [
      "Complex system architecture",
      "Long technical documents",
    ],
  },

  Gemini: {
    platform: "Gemini",
    modelName: "Gemini Pro",
    strengths: [
      "Google ecosystem integration",
      "Long context handling",
      "Multimodal understanding",
      "Research assistance",
      "Document analysis",
      "Mathematical reasoning",
    ],
    bestFor: [
      "Google Workspace integration",
      "Long document analysis",
      "Research tasks",
      "Educational content",
      "Mathematical problems",
      "Document summarization",
    ],
    contextLimit: 1000000,
    supportsImages: true,
    supportsFiles: true,
    supportsCodeInterpreter: false,
    supportsWebSearch: true,
    responseStyle: "balanced",
    reasoningAbility: "advanced",
    codingAbility: "advanced",
    writingAbility: "advanced",
    analysisAbility: "expert",
    recommendedFor: [
      "Research projects",
      "Document-heavy tasks",
      "Educational content",
      "Google Docs integration",
    ],
    notRecommendedFor: [
      "Complex debugging",
      "System architecture",
    ],
  },

  Grok: {
    platform: "Grok",
    modelName: "Grok-2",
    strengths: [
      "Real-time discussions",
      "Quick brainstorming",
      "Casual conversation",
      "Humor and personality",
      "Fast responses",
      "Social context",
    ],
    bestFor: [
      "Quick ideation",
      "Informal discussions",
      "Brainstorming sessions",
      "Social media content",
      "Rapid prototyping",
      "First drafts",
    ],
    contextLimit: 128000,
    supportsImages: true,
    supportsFiles: false,
    supportsCodeInterpreter: false,
    supportsWebSearch: true,
    responseStyle: "concise",
    reasoningAbility: "advanced",
    codingAbility: "advanced",
    writingAbility: "advanced",
    analysisAbility: "advanced",
    recommendedFor: [
      "Quick brainstorming",
      "Initial ideation",
      "Casual coding help",
      "Social content",
    ],
    notRecommendedFor: [
      "Complex projects",
      "Detailed documentation",
      "System architecture",
    ],
  },

  Perplexity: {
    platform: "Perplexity",
    modelName: "Perplexity Pro",
    strengths: [
      "Web search synthesis",
      "Research",
      "Citation generation",
      "Current information",
      "Source tracking",
    ],
    bestFor: [
      "Research questions",
      "Finding information",
      "Comparing sources",
      "Fact-checking",
    ],
    contextLimit: 32000,
    supportsImages: false,
    supportsFiles: false,
    supportsCodeInterpreter: false,
    supportsWebSearch: true,
    responseStyle: "concise",
    reasoningAbility: "advanced",
    codingAbility: "basic",
    writingAbility: "advanced",
    analysisAbility: "advanced",
    recommendedFor: ["Research", "Information lookup", "Web search"],
    notRecommendedFor: ["Coding", "Long conversations"],
  },

  DeepSeek: {
    platform: "DeepSeek",
    modelName: "DeepSeek",
    strengths: [
      "Coding",
      "Mathematical reasoning",
      "Cost efficiency",
    ],
    bestFor: [
      "Coding tasks",
      "Mathematical problems",
      "Budget-conscious usage",
    ],
    contextLimit: 64000,
    supportsImages: false,
    supportsFiles: false,
    supportsCodeInterpreter: false,
    supportsWebSearch: false,
    responseStyle: "balanced",
    reasoningAbility: "advanced",
    codingAbility: "expert",
    writingAbility: "advanced",
    analysisAbility: "advanced",
    recommendedFor: ["Coding", "Math", "Budget usage"],
    notRecommendedFor: ["Complex reasoning", "Creative writing"],
  },

  "Microsoft Copilot": {
    platform: "Microsoft Copilot",
    modelName: "Copilot",
    strengths: [
      "Microsoft integration",
      "Office document handling",
      "Web search",
    ],
    bestFor: [
      "Office productivity",
      "Document creation",
      "Enterprise workflows",
    ],
    contextLimit: 32000,
    supportsImages: true,
    supportsFiles: true,
    supportsCodeInterpreter: false,
    supportsWebSearch: true,
    responseStyle: "balanced",
    reasoningAbility: "advanced",
    codingAbility: "basic",
    writingAbility: "advanced",
    analysisAbility: "advanced",
    recommendedFor: ["Office tasks", "Enterprise", "Documents"],
    notRecommendedFor: ["Complex coding", "Architecture"],
  },

  "Google AI Studio": {
    platform: "Google AI Studio",
    modelName: "Gemini",
    strengths: [
      "Model experimentation",
      "Fine-tuning",
      "API testing",
    ],
    bestFor: [
      "Model testing",
      "Prompt engineering",
      "API development",
    ],
    contextLimit: 1000000,
    supportsImages: true,
    supportsFiles: true,
    supportsCodeInterpreter: false,
    supportsWebSearch: false,
    responseStyle: "balanced",
    reasoningAbility: "advanced",
    codingAbility: "advanced",
    writingAbility: "advanced",
    analysisAbility: "advanced",
    recommendedFor: ["Testing", "Experimentation", "API work"],
    notRecommendedFor: ["Production workflows"],
  },

  Other: {
    platform: "Other",
    modelName: "Unknown",
    strengths: [],
    bestFor: [],
    contextLimit: 32000,
    supportsImages: false,
    supportsFiles: false,
    supportsCodeInterpreter: false,
    supportsWebSearch: false,
    responseStyle: "balanced",
    reasoningAbility: "basic",
    codingAbility: "basic",
    writingAbility: "basic",
    analysisAbility: "basic",
    recommendedFor: [],
    notRecommendedFor: [],
  },
};

/**
 * Get capabilities for a specific platform.
 */
export function getModelCapabilities(platform: Platform): ModelCapabilities {
  return MODEL_REGISTRY[platform] || MODEL_REGISTRY.Other;
}

/**
 * Get all supported platforms.
 */
export function getSupportedPlatforms(): Platform[] {
  return Object.keys(MODEL_REGISTRY).filter((p) => p !== "Other") as Platform[];
}

/**
 * Calculate recommendation score for a platform based on context.
 */
export function calculateRecommendation(
  context: {
    hasCode: boolean;
    codeLines: number;
    isResearch: boolean;
    isCreative: boolean;
    isQuickTask: boolean;
    contextSize: number;
    needsWebSearch: boolean;
    hasImages: boolean;
    hasFiles: boolean;
  },
  excludePlatform?: Platform,
): ModelRecommendation[] {
  const recommendations: ModelRecommendation[] = [];

  for (const [platform, caps] of Object.entries(MODEL_REGISTRY)) {
    if (platform === "Other" || platform === excludePlatform) continue;

    let score = 50; // Base score
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Code-heavy project
    if (context.hasCode) {
      if (caps.codingAbility === "expert") {
        score += 20;
        reasons.push("Excellent for coding tasks");
      } else if (caps.codingAbility === "advanced") {
        score += 10;
        reasons.push("Good coding support");
      }
    }

    // Large context
    if (context.contextSize > 50000) {
      if (caps.contextLimit > 100000) {
        score += 15;
        reasons.push("Handles large context well");
      } else {
        warnings.push("May need context compression");
      }
    }

    // Research task
    if (context.isResearch) {
      if (caps.supportsWebSearch) {
        score += 15;
        reasons.push("Web search capability");
      }
      if (caps.analysisAbility === "expert") {
        score += 10;
        reasons.push("Strong analysis abilities");
      }
    }

    // Creative task
    if (context.isCreative) {
      if (caps.writingAbility === "expert") {
        score += 15;
        reasons.push("Excellent writing ability");
      }
    }

    // Quick task
    if (context.isQuickTask) {
      if (caps.responseStyle === "concise") {
        score += 10;
        reasons.push("Quick responses");
      }
    }

    // Images
    if (context.hasImages && !caps.supportsImages) {
      warnings.push("Does not support images");
      score -= 10;
    }

    // Files
    if (context.hasFiles && !caps.supportsFiles) {
      warnings.push("Does not support file uploads");
      score -= 5;
    }

    recommendations.push({
      platform: platform as Platform,
      score: Math.min(100, Math.max(0, score)),
      reasons,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  // Sort by score
  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * Get best platform for a given context type.
 */
export function getBestPlatformFor(
  type: "coding" | "research" | "creative" | "quick" | "analysis",
): Platform {
  switch (type) {
    case "coding":
      return "Claude";
    case "research":
      return "Gemini";
    case "creative":
      return "ChatGPT";
    case "quick":
      return "Grok";
    case "analysis":
      return "ChatGPT";
    default:
      return "Claude";
  }
}
