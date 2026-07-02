/**
 * Productivity Dashboard — Activity stats, quick actions, and workspace overview.
 *
 * Shows: Today's Activity, Recent Projects, Active Conversations, Most Used AI Models,
 * Recent Transfers, Pinned Items, Storage Usage, Task Progress, Workspace Statistics.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils';
import {
  Activity,
  FolderOpen,
  MessageSquare,
  FileText,
  StickyNote,
  SquareCheck,
  Code,
  Clipboard,
  Star,
  Pin,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Sparkles,
  HardDrive,
  Download,
  Upload,
  History,
  Plus,
  Search,
  Settings,
  ChevronRight,
  Calendar,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react';
import { useProjectStore } from '@/state';
import type { WorkspaceStats, AnalyticsSummary } from '@/engines/analytics';

// ============== TYPES ==============

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
  shortcut?: string;
}

interface StatCard {
  label: string;
  value: number | string;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

interface ProductivityDashboardProps {
  onNewProject?: () => void;
  onOpenSearch?: () => void;
  onOpenTimeline?: () => void;
  onOpenExport?: () => void;
  onOpenSettings?: () => void;
  onOpenProject?: (id: string) => void;
}

// ============== COMPONENT ==============

export function ProductivityDashboard({
  onNewProject,
  onOpenSearch,
  onOpenTimeline,
  onOpenExport,
  onOpenSettings,
  onOpenProject,
}: ProductivityDashboardProps) {
  const { projects, recentProjects, favoriteProjects, stats } = useProjectStore();
  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);

      // Mock data for now - in real implementation this would fetch from engines
      await new Promise((r) => setTimeout(r, 300));

      setWorkspaceStats({
        totalProjects: projects.length,
        activeProjects: stats.active,
        archivedProjects: stats.archived,
        favoriteProjects: stats.favorites,
        totalConversations: stats.totalConversations || 0,
        totalMessages: 0,
        totalFiles: 0,
        totalFileSize: 0,
        totalNotes: stats.totalNotes || 0,
        totalTasks: stats.totalTasks || 0,
        completedTasks: 0,
        totalSnippets: 0,
        totalClipboardItems: 0,
        storageUsed: 0,
        storageLimit: 50 * 1024 * 1024 * 1024,
      });

      setAnalytics({
        period: 'week',
        startDate: new Date(Date.now() - 604800000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        projectsCreated: 3,
        projectsOpened: 24,
        projectsArchived: 1,
        activeProjects: stats.active,
        conversationsCreated: 8,
        totalMessages: 156,
        avgMessagesPerConversation: 19.5,
        aiSwitches: 12,
        topModels: [
          { model: 'Claude 3.5 Sonnet', count: 45 },
          { model: 'GPT-4o', count: 32 },
          { model: 'Gemini Pro', count: 18 },
        ],
        avgResponseTime: 1.2,
        tasksCreated: 15,
        tasksCompleted: 11,
        tasksDeleted: 2,
        completionRate: 73,
        searchesPerformed: 34,
        topSearches: [
          { query: 'architecture', count: 8 },
          { query: 'search', count: 6 },
          { query: 'export', count: 5 },
        ],
        exportsCompleted: 5,
        topExportFormats: [
          { format: 'markdown', count: 3 },
          { format: 'json', count: 2 },
        ],
        totalSessions: 14,
        avgSessionDuration: 45,
        mostActiveDay: 'Tuesday',
        mostActiveHour: 10,
      });

      setIsLoading(false);
    };

    loadStats();
  }, [projects.length, stats]);

  // Quick actions
  const quickActions: QuickAction[] = useMemo(() => [
    {
      id: 'new-project',
      label: 'New Project',
      description: 'Create a new project',
      icon: <Plus className="w-4 h-4" />,
      color: 'bg-green-100 text-green-700',
      onClick: () => onNewProject?.(),
      shortcut: 'Ctrl+N',
    },
    {
      id: 'search',
      label: 'Search',
      description: 'Search everything',
      icon: <Search className="w-4 h-4" />,
      color: 'bg-blue-100 text-blue-700',
      onClick: () => onOpenSearch?.(),
      shortcut: 'Ctrl+Shift+K',
    },
    {
      id: 'timeline',
      label: 'Timeline',
      description: 'View activity history',
      icon: <History className="w-4 h-4" />,
      color: 'bg-purple-100 text-purple-700',
      onClick: () => onOpenTimeline?.(),
      shortcut: 'Ctrl+Shift+T',
    },
    {
      id: 'export',
      label: 'Export',
      description: 'Export workspace data',
      icon: <Download className="w-4 h-4" />,
      color: 'bg-cyan-100 text-cyan-700',
      onClick: () => onOpenExport?.(),
      shortcut: 'Ctrl+Shift+E',
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Manage preferences',
      icon: <Settings className="w-4 h-4" />,
      color: 'bg-slate-100 text-slate-700',
      onClick: () => onOpenSettings?.(),
    },
  ], [onNewProject, onOpenSearch, onOpenTimeline, onOpenExport, onOpenSettings]);

  // Stat cards
  const statCards: StatCard[] = useMemo(() => {
    if (!workspaceStats) return [];

    return [
      {
        label: 'Projects',
        value: workspaceStats.totalProjects,
        icon: <FolderOpen className="w-4 h-4" />,
        color: 'bg-blue-50 text-blue-700',
      },
      {
        label: 'Conversations',
        value: workspaceStats.totalConversations,
        icon: <MessageSquare className="w-4 h-4" />,
        color: 'bg-green-50 text-green-700',
      },
      {
        label: 'Notes',
        value: workspaceStats.totalNotes,
        icon: <StickyNote className="w-4 h-4" />,
        color: 'bg-purple-50 text-purple-700',
      },
      {
        label: 'Tasks',
        value: workspaceStats.totalTasks,
        icon: <SquareCheck className="w-4 h-4" />,
        color: 'bg-amber-50 text-amber-700',
      },
    ];
  }, [workspaceStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-omni-300 border-t-omni-900 rounded-full animate-spin" />
          <p className="text-sm text-omni-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-omni-900">Dashboard</h1>
          <p className="text-sm text-omni-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTimeline}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-omni-100 text-omni-700 hover:bg-omni-200 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Activity
          </button>
          <button
            onClick={onNewProject}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-omni-900 text-white hover:bg-omni-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-5 gap-3">
        {quickActions.map((action, idx) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            onClick={action.onClick}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border border-omni-200 bg-white hover:shadow-md hover:border-omni-300 transition-all',
              'dark:bg-omni-900 dark:border-omni-800 dark:hover:border-omni-700'
            )}
          >
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', action.color)}>
              {action.icon}
            </div>
            <div className="text-sm font-medium text-omni-900 dark:text-omni-100">
              {action.label}
            </div>
            {action.shortcut && (
              <kbd className="text-xs text-omni-400 px-1.5 py-0.5 rounded bg-omni-100 dark:bg-omni-800 font-mono">
                {action.shortcut}
              </kbd>
            )}
          </motion.button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.03 }}
            className="rounded-xl border border-omni-200 bg-white p-4 dark:bg-omni-900 dark:border-omni-800"
          >
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', stat.color)}>
                {stat.icon}
              </div>
              <div>
                <div className="text-2xl font-bold text-omni-900 dark:text-omni-100">
                  {stat.value}
                </div>
                <div className="text-xs text-omni-500">{stat.label}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="col-span-2 rounded-xl border border-omni-200 bg-white dark:bg-omni-900 dark:border-omni-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-omni-200 dark:border-omni-800">
            <h3 className="font-semibold text-omni-900 dark:text-omni-100">Recent Projects</h3>
            <button className="text-sm text-omni-500 hover:text-omni-700 flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-omni-200 dark:divide-omni-800">
            {recentProjects.slice(0, 5).map((project) => (
              <button
                key={project.id}
                onClick={() => onOpenProject?.(project.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-omni-50 dark:hover:bg-omni-800 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-omni-900 dark:text-omni-100 truncate">
                    {project.name}
                  </div>
                  <div className="text-xs text-omni-500 truncate">
                    {project.template || 'Project'} · {new Date(project.lastOpenedAt || project.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {project.isFavorite && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Task Progress */}
        <div className="rounded-xl border border-omni-200 bg-white dark:bg-omni-900 dark:border-omni-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-omni-200 dark:border-omni-800">
            <h3 className="font-semibold text-omni-900 dark:text-omni-100">Task Progress</h3>
            <div className="text-xs text-omni-500">This week</div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-omni-200 dark:text-omni-800"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 * (1 - (analytics?.completionRate || 0) / 100)}
                    className="text-green-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-omni-900 dark:text-omni-100">
                    {analytics?.completionRate || 0}%
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-omni-500">Completed</span>
                <span className="font-medium text-omni-900 dark:text-omni-100">{analytics?.tasksCompleted || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-omni-500">Created</span>
                <span className="font-medium text-omni-900 dark:text-omni-100">{analytics?.tasksCreated || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-omni-500">Remaining</span>
                <span className="font-medium text-omni-900 dark:text-omni-100">
                  {(analytics?.tasksCreated || 0) - (analytics?.tasksCompleted || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Usage & Activity */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top AI Models */}
        <div className="rounded-xl border border-omni-200 bg-white dark:bg-omni-900 dark:border-omni-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-omni-200 dark:border-omni-800">
            <h3 className="font-semibold text-omni-900 dark:text-omni-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              AI Models Used
            </h3>
            <div className="text-xs text-omni-500">Last 7 days</div>
          </div>
          <div className="p-4">
            {analytics?.topModels.map((model, idx) => (
              <div key={model.model} className="flex items-center gap-3 mb-3 last:mb-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-omni-100 dark:bg-omni-800 text-omni-600 dark:text-omni-300">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-omni-900 dark:text-omni-100">{model.model}</div>
                  <div className="w-full h-1.5 bg-omni-200 dark:bg-omni-800 rounded-full mt-1">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${(model.count / (analytics?.topModels[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-omni-500">{model.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Activity */}
        <div className="rounded-xl border border-omni-200 bg-white dark:bg-omni-900 dark:border-omni-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-omni-200 dark:border-omni-800">
            <h3 className="font-semibold text-omni-900 dark:text-omni-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Weekly Activity
            </h3>
            <div className="text-xs text-omni-500">{analytics?.totalSessions || 0} sessions</div>
          </div>
          <div className="p-4">
            <div className="flex items-end justify-between h-24 gap-2 mb-3">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                const height = Math.random() * 100;
                const isToday = idx === new Date().getDay() - 1;

                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        'w-full rounded-t-sm',
                        isToday ? 'bg-blue-500' : 'bg-omni-200 dark:bg-omni-700'
                      )}
                      style={{ height: `${height}%` }}
                    />
                    <span className={cn('text-xs', isToday ? 'text-blue-600 font-medium' : 'text-omni-400')}>
                      {day.slice(0, 1)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-omni-500">
                Most active: <span className="font-medium text-omni-900 dark:text-omni-100">{analytics?.mostActiveDay}</span>
              </span>
              <span className="text-omni-500">
                Avg: <span className="font-medium text-omni-900 dark:text-omni-100">{analytics?.avgSessionDuration}min</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Usage */}
      {workspaceStats && (
        <div className="rounded-xl border border-omni-200 bg-white dark:bg-omni-900 dark:border-omni-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-omni-900 dark:text-omni-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-omni-500" />
              Storage Usage
            </h3>
            <span className="text-sm text-omni-500">
              {((workspaceStats.storageUsed / workspaceStats.storageLimit) * 100).toFixed(1)}% used
            </span>
          </div>
          <div className="w-full h-2 bg-omni-200 dark:bg-omni-800 rounded-full mb-3">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(workspaceStats.storageUsed / workspaceStats.storageLimit) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-omni-500">
            <span>{Math.round(workspaceStats.storageUsed / 1024 / 1024)} MB used</span>
            <span>{Math.round(workspaceStats.storageLimit / 1024 / 1024 / 1024)} GB limit</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductivityDashboard;
