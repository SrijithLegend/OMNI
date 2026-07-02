import { useState } from 'react';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/Button';
import { useSubscription, PlanTier, BillingInterval } from '@/engines';
import { Check, CreditCard, Settings, Zap, Crown, Building2, Sparkles, ExternalLink, RefreshCw, CircleAlert as AlertCircle } from 'lucide-react';

interface SubscriptionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (tier: PlanTier) => void;
}

export function SubscriptionManager({ isOpen, onClose, onSelectPlan }: SubscriptionManagerProps) {
  const {
    subscription,
    limits,
    usage,
    plans,
    isLoading,
    createCheckout,
    openBillingPortal,
    cancel,
    reactivate,
    hasFeature,
    isWithinLimit,
  } = useSubscription();

  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('monthly');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPlan = async (tier: PlanTier) => {
    setError(null);
    if (tier === 'free') {
      onSelectPlan?.(tier);
      return;
    }

    setProcessing(true);
    try {
      const url = await createCheckout({
        tier,
        billingInterval: selectedInterval,
      });
      window.location.href = url;
    } catch {
      setError('Failed to start checkout. Please try again.');
      setProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    setProcessing(true);
    try {
      const url = await openBillingPortal();
      window.location.href = url;
    } catch {
      setError('Failed to open billing portal. Please try again.');
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;

    setProcessing(true);
    try {
      await cancel();
    } catch {
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async () => {
    setProcessing(true);
    try {
      await reactivate();
    } catch {
      setError('Failed to reactivate subscription. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getPlanIcon = (tier: PlanTier) => {
    switch (tier) {
      case 'pro':
        return <Zap className="w-5 h-5" />;
      case 'team':
        return <Crown className="w-5 h-5" />;
      case 'enterprise':
        return <Building2 className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const getPrice = (tier: PlanTier, interval: BillingInterval) => {
    const plan = plans.find((p) => p.tier === tier);
    if (!plan) return 0;
    return interval === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  };

  const currentTier = subscription?.tier || 'free';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Subscription" size="xl">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-lg border border-red-500/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Current Plan Banner */}
          {subscription && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                    {getPlanIcon(currentTier)}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-100">
                      Current plan: {limits?.name || 'Free'}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {subscription.cancelAtPeriodEnd
                        ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={handleManageBilling} disabled={processing}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage billing
                </Button>
              </div>

              {subscription.cancelAtPeriodEnd && (
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    Your subscription will end soon. Reactivate to keep your benefits.
                  </p>
                  <Button variant="primary" onClick={handleReactivate} disabled={processing}>
                    Reactivate
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setSelectedInterval('monthly')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                selectedInterval === 'monthly'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedInterval('yearly')}
              className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                selectedInterval === 'yearly'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Yearly
              <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                Save 17%
              </span>
            </button>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isCurrent = currentTier === plan.tier;
              const price = getPrice(plan.tier, selectedInterval);

              return (
                <div
                  key={plan.tier}
                  className={`relative p-4 rounded-xl border ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-500/5'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  } transition-colors`}
                >
                  {isCurrent && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-500 text-xs rounded text-white">
                      Current
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      {getPlanIcon(plan.tier)}
                      <h4 className="font-medium text-slate-100">{plan.name}</h4>
                    </div>

                    <div>
                      <span className="text-3xl font-bold text-slate-100">
                        ${price}
                      </span>
                      <span className="text-slate-500">/{selectedInterval === 'yearly' ? 'mo' : 'month'}</span>
                    </div>

                    <ul className="space-y-2 text-sm">
                      <FeatureItem included={true} text={`${plan.maxProjects === -1 ? 'Unlimited' : plan.maxProjects} projects`} />
                      <FeatureItem included={true} text={`${plan.maxCaptures === -1 ? 'Unlimited' : plan.maxCaptures.toLocaleString()} captures`} />
                      <FeatureItem included={plan.features.oAuth} text="OAuth sign-in" />
                      <FeatureItem included={plan.features.cloudSync} text="Cloud sync" />
                      <FeatureItem included={plan.features.backup} text="Backups" />
                      <FeatureItem included={plan.features.advancedAi} text="Advanced AI" />
                      <FeatureItem included={plan.features.teamCollaboration} text="Team features" />
                    </ul>

                    <div className="pt-4">
                      {isCurrent ? (
                        currentTier !== 'free' && (
                          <Button
                            variant="ghost"
                            className="w-full text-red-400 hover:text-red-300"
                            onClick={handleCancel}
                            disabled={processing}
                          >
                            Cancel plan
                          </Button>
                        )
                      ) : (
                        <Button
                          variant={plan.tier === 'pro' ? 'primary' : 'outline'}
                          className="w-full"
                          onClick={() => handleSelectPlan(plan.tier)}
                          disabled={processing}
                        >
                          {plan.tier === 'free' ? 'Downgrade' : 'Upgrade'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Usage Stats */}
          {usage && limits && (
            <div className="pt-6 border-t border-slate-700">
              <h3 className="text-lg font-medium text-slate-100 mb-4">Current usage</h3>
              <div className="grid grid-cols-4 gap-4">
                <UsageBar
                  label="Projects"
                  used={usage.projects}
                  limit={limits.maxProjects}
                />
                <UsageBar
                  label="Captures"
                  used={usage.captures}
                  limit={limits.maxCaptures}
                />
                <UsageBar
                  label="AI Summaries"
                  used={usage.aiSummaries}
                  limit={limits.maxAiSummaries}
                />
                <UsageBar
                  label="Cloud Storage"
                  used={usage.cloudStorageMb}
                  limit={limits.maxCloudStorageMb}
                  unit="MB"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function FeatureItem({ included, text }: { included: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-2 ${included ? 'text-slate-300' : 'text-slate-600'}`}>
      <Check className={`w-4 h-4 ${included ? 'text-green-400' : 'text-slate-600'}`} />
      {text}
    </li>
  );
}

function UsageBar({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}) {
  const percentage = limit === -1 ? 0 : Math.min((used / limit) * 100, 100);
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">
          {used.toLocaleString()} / {limit === -1 ? 'Unlimited' : limit.toLocaleString()}
          {unit && ` ${unit}`}
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
