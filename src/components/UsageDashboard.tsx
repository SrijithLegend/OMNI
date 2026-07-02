import { useState, useEffect } from 'react';
import { useSubscription, PlanTier } from '@/engines';
import {
  FolderOpen,
  MessageSquare,
  FileText,
  Link2,
  Cloud,
  Monitor,
  HardDrive,
  Zap,
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
} from 'lucide-react';

interface UsageDashboardProps {
  onClose?: () => void;
}

export function UsageDashboard({ onClose }: UsageDashboardProps) {
  const { subscription, limits, usage, isLoading, plans } = useSubscription();
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free';
  const currentPlan = plans.find((p) => p.tier === currentTier);

  const usageMetrics = [
    {
      id: 'projects',
      label: 'Projects',
      icon: <FolderOpen className="w-5 h-5" />,
      used: usage?.projects || 0,
      limit: limits?.maxProjects || 3,
      color: 'blue',
    },
    {
      id: 'captures',
      label: 'Captures',
      icon: <MessageSquare className="w-5 h-5" />,
      used: usage?.captures || 0,
      limit: limits?.maxCaptures || 100,
      color: 'green',
    },
    {
      id: 'summaries',
      label: 'AI Summaries',
      icon: <Zap className="w-5 h-5" />,
      used: usage?.aiSummaries || 0,
      limit: limits?.maxAiSummaries || 10,
      color: 'amber',
    },
    {
      id: 'storage',
      label: 'Cloud Storage',
      icon: <Cloud className="w-5 h-5" />,
      used: usage?.cloudStorageMb || 0,
      limit: limits?.maxCloudStorageMb || 50,
      unit: 'MB',
      color: 'purple',
    },
    {
      id: 'devices',
      label: 'Devices',
      icon: <Monitor className="w-5 h-5" />,
      used: usage?.devices || 1,
      limit: limits?.maxDevices || 2,
      color: 'cyan',
    },
  ];

  const getColorClass = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      amber: 'bg-amber-500',
      purple: 'bg-purple-500',
      cyan: 'bg-cyan-500',
      red: 'bg-red-500',
    };
    return colors[color] || 'bg-slate-500';
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageStatus = (used: number, limit: number) => {
    if (limit === -1) return 'unlimited';
    const percentage = (used / limit) * 100;
    if (percentage >= 100) return 'exceeded';
    if (percentage >= 80) return 'warning';
    return 'normal';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Usage Dashboard</h2>
          <p className="text-sm text-slate-400">
            Current plan: <span className="text-slate-200">{currentPlan?.name || 'Free'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'day' | 'week' | 'month')}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* Plan Banner */}
      <div className="p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-slate-100">
              {currentPlan?.name} Plan
            </h3>
            {subscription ? (
              <p className="text-sm text-slate-400">
                {subscription.cancelAtPeriodEnd
                  ? `Expires ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Upgrade for more features
              </p>
            )}
          </div>
          {subscription?.tier === 'free' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Upgrade Plan
            </button>
          )}
        </div>
      </div>

      {/* Usage Cards */}
      <div className="grid grid-cols-2 gap-4">
        {usageMetrics.map((metric) => {
          const status = getUsageStatus(metric.used, metric.limit);
          const percentage = getUsagePercentage(metric.used, metric.limit);

          return (
            <div
              key={metric.id}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${getColorClass(metric.color)} bg-opacity-20`}>
                    <span className={`text-${metric.color}-400`}>{metric.icon}</span>
                  </div>
                  <span className="font-medium text-slate-200">{metric.label}</span>
                </div>
                {status === 'exceeded' && (
                  <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                    Limit reached
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Used</span>
                  <span className="text-slate-200">
                    {metric.used.toLocaleString()} / {metric.limit === -1 ? '∞' : metric.limit.toLocaleString()}
                    {metric.unit && ` ${metric.unit}`}
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      status === 'exceeded'
                        ? 'bg-red-500'
                        : status === 'warning'
                        ? 'bg-amber-500'
                        : getColorClass(metric.color)
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity Summary */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h3 className="font-medium text-slate-100 mb-4">Recent Activity</h3>
        <div className="grid grid-cols-3 gap-4">
          <ActivityStat
            icon={<MessageSquare className="w-4 h-4" />}
            label="Captures"
            value={24}
            change="+5"
          />
          <ActivityStat
            icon={<Link2 className="w-4 h-4" />}
            label="AI Switches"
            value={12}
            change="+3"
          />
          <ActivityStat
            icon={<Cloud className="w-4 h-4" />}
            label="Syncs"
            value={48}
            change="+8"
          />
        </div>
      </div>

      {/* Storage Breakdown */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h3 className="font-medium text-slate-100 mb-4">Storage Breakdown</h3>
        <div className="space-y-3">
          <StorageRow
            label="Conversations"
            size={12.4}
            percentage={35}
            color="blue"
          />
          <StorageRow
            label="Files"
            size={8.2}
            percentage={23}
            color="green"
          />
          <StorageRow
            label="Notes"
            size={4.1}
            percentage={12}
            color="amber"
          />
          <StorageRow
            label="Other"
            size={10.3}
            percentage={30}
            color="slate"
          />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Total: 35.0 MB / {limits?.maxCloudStorageMb || 50} MB
          </div>
          <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
            <Download className="w-4 h-4" />
            Export Data
          </button>
        </div>
      </div>

      {/* Connected Services */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h3 className="font-medium text-slate-100 mb-4">Connected Services</h3>
        <div className="grid grid-cols-4 gap-3">
          <ConnectedService name="GitHub" connected={true} />
          <ConnectedService name="Google" connected={true} />
          <ConnectedService name="Notion" connected={false} />
          <ConnectedService name="Slack" connected={false} />
        </div>
      </div>

      {/* Plan Comparison */}
      {currentTier === 'free' && (
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-100">Upgrade to Pro</h3>
            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
              Save 17% yearly
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-400">More projects</p>
              <p className="text-slate-200 font-medium">3 → 50</p>
            </div>
            <div>
              <p className="text-slate-400">More storage</p>
              <p className="text-slate-200 font-medium">50MB → 1GB</p>
            </div>
            <div>
              <p className="text-slate-400">Cloud sync</p>
              <p className="text-slate-200 font-medium">✓ Included</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors"
          >
            View All Plans
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityStat({
  icon,
  label,
  value,
  change,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  change: string;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
      <div className="text-xs text-green-400">{change}</div>
    </div>
  );
}

function StorageRow({
  label,
  size,
  percentage,
  color,
}: {
  label: string;
  size: number;
  percentage: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded ${color === 'blue' ? 'bg-blue-500' : color === 'green' ? 'bg-green-500' : color === 'amber' ? 'bg-amber-500' : 'bg-slate-500'}`} />
      <span className="flex-1 text-sm text-slate-300">{label}</span>
      <span className="text-sm text-slate-400">{size.toFixed(1)} MB</span>
      <span className="text-xs text-slate-500">{percentage}%</span>
    </div>
  );
}

function ConnectedService({
  name,
  connected,
}: {
  name: string;
  connected: boolean;
}) {
  return (
    <div
      className={`p-3 text-center rounded-lg border ${
        connected
          ? 'border-green-500/30 bg-green-500/10'
          : 'border-slate-700 bg-slate-800'
      }`}
    >
      <p className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-slate-500'}`}>
        {name}
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {connected ? 'Connected' : 'Not linked'}
      </p>
    </div>
  );
}
