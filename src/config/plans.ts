/**
 * Plan Configuration System
 * Centralized configuration for all subscription plans and their limits.
 * Never hardcode limits elsewhere - always import from this module.
 */

import { PlanTier } from '@/engines';

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  savings: string;
  limits: PlanLimits;
  features: PlanFeatures;
  badges: string[];
  cta: string;
  highlighted: boolean;
}

export interface PlanLimits {
  projects: number;
  captures: number;
  aiSummaries: number;
  cloudStorageMb: number;
  devices: number;
  teamMembers: number;
  exports: number;
  backups: number;
  connectorAccounts: number;
  retentionDays: number;
}

export interface PlanFeatures {
  oAuth: boolean;
  cloudSync: boolean;
  backup: boolean;
  advancedAi: boolean;
  teamCollaboration: boolean;
  prioritySupport: boolean;
  customIntegrations: boolean;
  api: boolean;
  analytics: boolean;
  exportFormats: string[];
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    name: 'Free',
    description: 'Perfect for getting started with Omni',
    priceMonthly: 0,
    priceYearly: 0,
    savings: '',
    limits: {
      projects: 3,
      captures: 100,
      aiSummaries: 10,
      cloudStorageMb: 50,
      devices: 2,
      teamMembers: 1,
      exports: 5,
      backups: 1,
      connectorAccounts: 2,
      retentionDays: 30,
    },
    features: {
      oAuth: false,
      cloudSync: false,
      backup: false,
      advancedAi: false,
      teamCollaboration: false,
      prioritySupport: false,
      customIntegrations: false,
      api: false,
      analytics: false,
      exportFormats: ['json', 'markdown'],
    },
    badges: [],
    cta: 'Get Started',
    highlighted: false,
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    description: 'For power users and professionals',
    priceMonthly: 9,
    priceYearly: 90,
    savings: 'Save 17%',
    limits: {
      projects: 50,
      captures: 10000,
      aiSummaries: 500,
      cloudStorageMb: 1000,
      devices: 5,
      teamMembers: 1,
      exports: -1,
      backups: 10,
      connectorAccounts: 10,
      retentionDays: -1,
    },
    features: {
      oAuth: true,
      cloudSync: true,
      backup: true,
      advancedAi: true,
      teamCollaboration: false,
      prioritySupport: false,
      customIntegrations: false,
      api: false,
      analytics: true,
      exportFormats: ['json', 'markdown', 'pdf', 'html', 'csv'],
    },
    badges: ['Most Popular'],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  team: {
    tier: 'team',
    name: 'Team',
    description: 'Collaborate with your team',
    priceMonthly: 29,
    priceYearly: 290,
    savings: 'Save 17%',
    limits: {
      projects: 200,
      captures: 50000,
      aiSummaries: 2000,
      cloudStorageMb: 5000,
      devices: 10,
      teamMembers: 10,
      exports: -1,
      backups: -1,
      connectorAccounts: 20,
      retentionDays: -1,
    },
    features: {
      oAuth: true,
      cloudSync: true,
      backup: true,
      advancedAi: true,
      teamCollaboration: true,
      prioritySupport: true,
      customIntegrations: false,
      api: true,
      analytics: true,
      exportFormats: ['json', 'markdown', 'pdf', 'html', 'csv', 'xlsx'],
    },
    badges: ['Best for Teams'],
    cta: 'Start Team Trial',
    highlighted: false,
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for organizations',
    priceMonthly: 99,
    priceYearly: 990,
    savings: 'Save 17%',
    limits: {
      projects: -1,
      captures: -1,
      aiSummaries: -1,
      cloudStorageMb: -1,
      devices: -1,
      teamMembers: -1,
      exports: -1,
      backups: -1,
      connectorAccounts: -1,
      retentionDays: -1,
    },
    features: {
      oAuth: true,
      cloudSync: true,
      backup: true,
      advancedAi: true,
      teamCollaboration: true,
      prioritySupport: true,
      customIntegrations: true,
      api: true,
      analytics: true,
      exportFormats: ['json', 'markdown', 'pdf', 'html', 'csv', 'xlsx', 'docx'],
    },
    badges: ['Contact Sales'],
    cta: 'Schedule Demo',
    highlighted: false,
  },
};

export function getPlanConfig(tier: PlanTier): PlanConfig {
  return PLAN_CONFIGS[tier];
}

export function getAllPlans(): PlanConfig[] {
  return Object.values(PLAN_CONFIGS);
}

export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLAN_CONFIGS[tier].limits;
}

export function getPlanFeatures(tier: PlanTier): PlanFeatures {
  return PLAN_CONFIGS[tier].features;
}

export function isFeatureAvailable(tier: PlanTier, feature: keyof PlanFeatures): boolean {
  return PLAN_CONFIGS[tier].features[feature] === true;
}

export function isWithinLimit(
  tier: PlanTier,
  limitKey: keyof PlanLimits,
  currentUsage: number
): boolean {
  const limit = PLAN_CONFIGS[tier].limits[limitKey];
  if (limit === -1) return true;
  return currentUsage < limit;
}

export function getLimitRemaining(
  tier: PlanTier,
  limitKey: keyof PlanLimits,
  currentUsage: number
): number {
  const limit = PLAN_CONFIGS[tier].limits[limitKey];
  if (limit === -1) return Infinity;
  return Math.max(0, limit - currentUsage);
}

export function getLimitPercentage(
  tier: PlanTier,
  limitKey: keyof PlanLimits,
  currentUsage: number
): number {
  const limit = PLAN_CONFIGS[tier].limits[limitKey];
  if (limit === -1) return 0;
  return Math.min(100, (currentUsage / limit) * 100);
}

export function formatLimit(value: number): string {
  if (value === -1) return 'Unlimited';
  return value.toLocaleString();
}

export function getUpgradeMessage(currentTier: PlanTier): string {
  const tiers: PlanTier[] = ['free', 'pro', 'team', 'enterprise'];
  const currentIndex = tiers.indexOf(currentTier);

  if (currentIndex >= tiers.length - 1) {
    return "You're on the highest tier";
  }

  const nextTier = tiers[currentIndex + 1];
  const nextConfig = PLAN_CONFIGS[nextTier];

  return `Upgrade to ${nextConfig.name} for more features`;
}

export function comparePlans(
  currentTier: PlanTier,
  comparisonTier: PlanTier
): {
  limitChanges: Partial<Record<keyof PlanLimits, { current: number; new: number }>>;
  newFeatures: (keyof PlanFeatures)[];
} {
  const currentLimits = PLAN_CONFIGS[currentTier].limits;
  const comparisonLimits = PLAN_CONFIGS[comparisonTier].limits;
  const currentFeatures = PLAN_CONFIGS[currentTier].features;
  const comparisonFeatures = PLAN_CONFIGS[comparisonTier].features;

  const limitChanges: Partial<Record<keyof PlanLimits, { current: number; new: number }>> = {};

  for (const key of Object.keys(currentLimits) as (keyof PlanLimits)[]) {
    if (currentLimits[key] !== comparisonLimits[key]) {
      limitChanges[key] = {
        current: currentLimits[key],
        new: comparisonLimits[key],
      };
    }
  }

  const newFeatures: (keyof PlanFeatures)[] = [];

  for (const key of Object.keys(comparisonFeatures) as (keyof PlanFeatures)[]) {
    if (!currentFeatures[key] && comparisonFeatures[key]) {
      newFeatures.push(key);
    }
  }

  return { limitChanges, newFeatures };
}
