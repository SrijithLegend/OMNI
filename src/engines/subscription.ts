/**
 * Subscription Engine — Stripe-powered subscription management.
 *
 * Features: Plans, Billing, Usage Tracking, Webhooks
 */

import { BaseEngine } from "./base";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============== TYPES ==============

export type PlanTier = 'free' | 'pro' | 'team' | 'enterprise';
export type BillingInterval = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

export interface PlanLimits {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceMonthlyId: string | null;
  stripePriceYearlyId: string | null;
  maxProjects: number;
  maxCaptures: number;
  maxAiSummaries: number;
  maxCloudStorageMb: number;
  maxDevices: number;
  maxTeamMembers: number;
  features: Record<string, boolean>;
}

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  tier: PlanTier;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

export interface UsageStats {
  projects: number;
  captures: number;
  aiSummaries: number;
  cloudStorageMb: number;
  devices: number;
  teamMembers: number;
}

export interface CheckoutOptions {
  tier: PlanTier;
  billingInterval: BillingInterval;
  successUrl?: string;
  cancelUrl?: string;
}

export interface BillingPortalOptions {
  returnUrl?: string;
}

export interface SubscriptionState {
  subscription: Subscription | null;
  limits: PlanLimits | null;
  usage: UsageStats | null;
  isLoading: boolean;
  error: string | null;
}

// ============== DEFAULT LIMITS ==============

const DEFAULT_LIMITS: Record<PlanTier, Omit<PlanLimits, 'stripePriceMonthlyId' | 'stripePriceYearlyId'>> = {
  free: {
    tier: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    maxProjects: 3,
    maxCaptures: 100,
    maxAiSummaries: 10,
    maxCloudStorageMb: 50,
    maxDevices: 2,
    maxTeamMembers: 1,
    features: {
      oAuth: false,
      cloudSync: false,
      backup: false,
      advancedAi: false,
      teamCollaboration: false,
      prioritySupport: false,
      customIntegrations: false,
      api: false,
    },
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: 9,
    priceYearly: 90,
    maxProjects: 50,
    maxCaptures: 10000,
    maxAiSummaries: 500,
    maxCloudStorageMb: 1000,
    maxDevices: 5,
    maxTeamMembers: 1,
    features: {
      oAuth: true,
      cloudSync: true,
      backup: true,
      advancedAi: true,
      teamCollaboration: false,
      prioritySupport: false,
      customIntegrations: false,
      api: false,
    },
  },
  team: {
    tier: 'team',
    name: 'Team',
    priceMonthly: 29,
    priceYearly: 290,
    maxProjects: 200,
    maxCaptures: 50000,
    maxAiSummaries: 2000,
    maxCloudStorageMb: 5000,
    maxDevices: 10,
    maxTeamMembers: 10,
    features: {
      oAuth: true,
      cloudSync: true,
      backup: true,
      advancedAi: true,
      teamCollaboration: true,
      prioritySupport: true,
      customIntegrations: false,
      api: true,
    },
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 99,
    priceYearly: 990,
    maxProjects: -1,
    maxCaptures: -1,
    maxAiSummaries: -1,
    maxCloudStorageMb: -1,
    maxDevices: -1,
    maxTeamMembers: -1,
    features: {
      oAuth: true,
      cloudSync: true,
      backup: true,
      advancedAi: true,
      teamCollaboration: true,
      prioritySupport: true,
      customIntegrations: true,
      api: true,
    },
  },
};

// ============== ENGINE ==============

export class SubscriptionEngine extends BaseEngine {
  private supabase: SupabaseClient | null = null;
  private state: SubscriptionState = {
    subscription: null,
    limits: null,
    usage: null,
    isLoading: true,
    error: null,
  };

  constructor() {
    super({ name: "SubscriptionEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      await this.loadSubscription();
    }

    this.isRunning = true;
    this.emit("ready", this.state);
  }

  async stop(): Promise<void> {
    this.supabase = null;
    this.isRunning = false;
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    return {
      ok: true,
      message: `Subscription: ${this.state.subscription?.tier || 'free'}`,
      timestamp: Date.now(),
    };
  }

  // ============== SUBSCRIPTION MANAGEMENT ==============

  /**
   * Get all available plans
   */
  getPlans(): PlanLimits[] {
    return Object.values(DEFAULT_LIMITS).map((plan) => ({
      ...plan,
      stripePriceMonthlyId: null,
      stripePriceYearlyId: null,
    }));
  }

  /**
   * Get current subscription state
   */
  getState(): SubscriptionState {
    return { ...this.state };
  }

  /**
   * Get current limits for the user
   */
  getLimits(): PlanLimits {
    if (this.state.limits) {
      return this.state.limits;
    }
    return {
      ...DEFAULT_LIMITS.free,
      stripePriceMonthlyId: null,
      stripePriceYearlyId: null,
    };
  }

  /**
   * Get current usage stats
   */
  getUsage(): UsageStats | null {
    return this.state.usage;
  }

  /**
   * Check if a feature is available
   */
  hasFeature(feature: string): boolean {
    const limits = this.getLimits();
    return limits.features[feature] === true;
  }

  /**
   * Check if usage is within limits
   */
  isWithinLimit(resource: keyof Omit<UsageStats, 'cloudStorageMb'>): boolean {
    const limits = this.getLimits();
    const usage = this.state.usage || {
      projects: 0,
      captures: 0,
      aiSummaries: 0,
      cloudStorageMb: 0,
      devices: 0,
      teamMembers: 0,
    };

    const limitKey = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof PlanLimits;
    const limit = limits[limitKey] as number;

    if (limit === -1) return true;
    return usage[resource] < limit;
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(options: CheckoutOptions): Promise<string> {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: options.tier,
        billingInterval: options.billingInterval,
        successUrl: options.successUrl || `${window.location.origin}/billing/success`,
        cancelUrl: options.cancelUrl || `${window.location.origin}/billing`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create checkout session');
    }

    const { url } = await response.json();
    return url;
  }

  /**
   * Create billing portal session
   */
  async createBillingPortalSession(options: BillingPortalOptions = {}): Promise<string> {
    const response = await fetch('/api/stripe/billing-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnUrl: options.returnUrl || `${window.location.origin}/billing`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create billing portal session');
    }

    const { url } = await response.json();
    return url;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(immediately = false): Promise<void> {
    if (!this.state.subscription) {
      throw new Error('No active subscription');
    }

    const response = await fetch('/api/stripe/cancel-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: this.state.subscription.stripeSubscriptionId,
        immediately,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel subscription');
    }

    await this.loadSubscription();
    this.emit('subscription-canceled', this.state.subscription);
  }

  /**
   * Reactivate canceled subscription
   */
  async reactivateSubscription(): Promise<void> {
    if (!this.state.subscription?.cancelAtPeriodEnd) {
      throw new Error('Subscription cannot be reactivated');
    }

    const response = await fetch('/api/stripe/reactivate-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: this.state.subscription.stripeSubscriptionId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reactivate subscription');
    }

    await this.loadSubscription();
    this.emit('subscription-reactivated', this.state.subscription);
  }

  // ============== INTERNAL ==============

  private async loadSubscription(): Promise<void> {
    if (!this.supabase) return;

    this.state.isLoading = true;

    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        this.state = {
          subscription: null,
          limits: { ...DEFAULT_LIMITS.free, stripePriceMonthlyId: null, stripePriceYearlyId: null },
          usage: null,
          isLoading: false,
          error: null,
        };
        return;
      }

      // Load subscription from database
      const { data: subscription } = await this.supabase
        .from('omni_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (subscription) {
        this.state.subscription = {
          id: subscription.id,
          userId: subscription.user_id,
          stripeCustomerId: subscription.stripe_customer_id,
          stripeSubscriptionId: subscription.stripe_subscription_id,
          tier: subscription.tier,
          status: subscription.status,
          billingInterval: subscription.billing_interval,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          trialEnd: subscription.trial_end,
        };

        this.state.limits = {
          ...DEFAULT_LIMITS[subscription.tier as PlanTier],
          stripePriceMonthlyId: subscription.stripe_price_monthly_id,
          stripePriceYearlyId: subscription.stripe_price_yearly_id,
        };
      } else {
        this.state.limits = { ...DEFAULT_LIMITS.free, stripePriceMonthlyId: null, stripePriceYearlyId: null };
      }

      // Load usage stats
      await this.loadUsageStats(user.id);

      this.state.error = null;
    } catch (error) {
      this.log('error', 'Failed to load subscription', error);
      this.state.error = error instanceof Error ? error.message : 'Failed to load subscription';
    } finally {
      this.state.isLoading = false;
    }
  }

  private async loadUsageStats(userId: string): Promise<void> {
    if (!this.supabase) return;

    try {
      // Get project count
      const { count: projects } = await this.supabase
        .from('omni_projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get capture count
      const { count: captures } = await this.supabase
        .from('omni_captures')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get device count
      const { count: devices } = await this.supabase
        .from('omni_user_devices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Calculate storage (simplified)
      const storageUsed = (captures || 0) * 0.1;

      this.state.usage = {
        projects: projects || 0,
        captures: captures || 0,
        aiSummaries: 0,
        cloudStorageMb: storageUsed,
        devices: devices || 0,
        teamMembers: 1,
      };
    } catch (error) {
      this.log('warn', 'Failed to load usage stats', error);
    }
  }
}

// ============== SINGLETON ==============

let _instance: SubscriptionEngine | null = null;

export function getSubscriptionEngine(): SubscriptionEngine {
  if (!_instance) {
    _instance = new SubscriptionEngine();
  }
  return _instance;
}

// ============== REACT HOOK ==============

import { useState, useEffect, useCallback } from 'react';

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    subscription: null,
    limits: null,
    usage: null,
    isLoading: true,
    error: null,
  });

  const engine = getSubscriptionEngine();

  useEffect(() => {
    setState(engine.getState());

    const handleUpdate = () => setState(engine.getState());

    engine.on('subscription-canceled', handleUpdate);
    engine.on('subscription-reactivated', handleUpdate);
    engine.on('ready', handleUpdate);

    return () => {
      engine.off('subscription-canceled', handleUpdate);
      engine.off('subscription-reactivated', handleUpdate);
      engine.off('ready', handleUpdate);
    };
  }, [engine]);

  const createCheckout = useCallback(
    (options: CheckoutOptions) => engine.createCheckoutSession(options),
    [engine]
  );

  const openBillingPortal = useCallback(
    (options?: BillingPortalOptions) => engine.createBillingPortalSession(options),
    [engine]
  );

  const cancel = useCallback(
    (immediately = false) => engine.cancelSubscription(immediately),
    [engine]
  );

  const reactivate = useCallback(() => engine.reactivateSubscription(), [engine]);

  return {
    ...state,
    plans: engine.getPlans(),
    limits: engine.getLimits(),
    hasFeature: engine.hasFeature.bind(engine),
    isWithinLimit: engine.isWithinLimit.bind(engine),
    createCheckout,
    openBillingPortal,
    cancel,
    reactivate,
  };
}
