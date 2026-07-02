/**
 * Global Timeline — Chronological activity feed with filters and grouping.
 *
 * Shows: Project events, AI switches, File uploads, Task completions, etc.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils';
import {
  History,
  FolderPlus,
  FolderOpen,
  RefreshCw,
  Upload,
  Download,
  StickyNote,
  SquareCheck,
  Code,
  Clipboard,
  Star,
  Pin,
  Archive,
  Trash2,
  Settings,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Sparkles,
  Zap,
  MessageSquare,
  FileText,
  ExternalLink,
} from 'lucide-react';

// ============== TYPES ==============

type TimelineEventType =
  | 'project_created'
  | 'project_updated'
  | 'project_archived'
  | 'project_restored'
  | 'conversation_created'
  | 'ai_switched'
  | 'file_uploaded'
  | 'file_downloaded'
  | 'note_created'
  | 'task_created'
  | 'task_completed'
  | 'snippet_created'
  | 'clipboard_copied'
  | 'pinned'
  | 'export_started'
  | 'export_completed';

type TimelineCategory =
  | 'project'
  | 'conversation'
  | 'ai'
  | 'file'
  | 'note'
  | 'task'
  | 'snippet'
  | 'clipboard'
  | 'system';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  category: TimelineCategory;
  projectId?: string;
  projectName?: string;
  title: string;
  description?: string;
  icon: string;
  color: string;
  importance: 'low' | 'normal' | 'high';
  metadata: Record<string, unknown>;
  timestamp: number;
}

interface TimelineFilter {
  categories: TimelineCategory[];
  importance: ('low' | 'normal' | 'high')[];
  search: string;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  projectId?: string;
}

interface TimelineProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectSelect?: (id: string) => void;
  onExport?: () => void;
  projectId?: string;
}

// ============== MOCK DATA ==============

function generateMockEvents(): TimelineEvent[] {
  const now = Date.now();

  return [
    {
      id: '1',
      type: 'project_created',
      category: 'project',
      projectId: 'p1',
      projectName: 'AI Assistant',
      title: 'Project created',
      description: 'Created "AI Assistant"',
      icon: 'folder-plus',
      color: 'blue',
      importance: 'high',
      metadata: { platform: 'claude' },
      timestamp: now - 1000 * 60 * 60 * 24,
    },
    {
      id: '2',
      type: 'ai_switched',
      category: 'ai',
      projectId: 'p1',
      projectName: 'AI Assistant',
      title: 'Switched AI model',
      description: 'Changed from Claude 3 Opus to Claude 3.5 Sonnet',
      icon: 'sparkles',
      color: 'purple',
      importance: 'normal',
      metadata: { from: 'claude-3-opus', to: 'claude-3.5-sonnet' },
      timestamp: now - 1000 * 60 * 60 * 12,
    },
    {
      id: '3',
      type: 'note_created',
      category: 'note',
      projectId: 'p1',
      projectName: 'AI Assistant',
      title: 'Note created',
      description: 'Created note "Architecture Overview"',
      icon: 'sticky-note',
      color: 'purple',
      importance: 'normal',
      metadata: { noteId: 'n1' },
      timestamp: now - 1000 * 60 * 60 * 8,
    },
    {
      id: '4',
      type: 'task_completed',
      category: 'task',
      projectId: 'p1',
      projectName: 'AI Assistant',
      title: 'Task completed',
      description: 'Completed "Implement search feature"',
      icon: 'check-square',
      color: 'green',
      importance: 'high',
      metadata: { taskId: 't1' },
      timestamp: now - 1000 * 60 * 60 * 4,
    },
    {
      id: '5',
      type: 'snippet_created',
      category: 'snippet',
      projectId: 'p1',
      projectName: 'AI Assistant',
      title: 'Snippet saved',
      description: 'Saved code snippet "Fuzzy Match Function"',
      icon: 'code',
      color: 'cyan',
      importance: 'normal',
      metadata: { snippetId: 's1', language: 'typescript' },
      timestamp: now - 1000 * 60 * 30,
    },
    {
      id: '6',
      type: 'file_uploaded',
      category: 'file',
      projectId: 'p1',
      projectName: 'AI Assistant',
      title: 'File uploaded',
      description: 'Uploaded "requirements.pdf" (2.4 MB)',
      icon: 'upload',
      color: 'orange',
      importance: 'normal',
      metadata: { fileId: 'f1', size: 2400000 },
      timestamp: now - 1000 * 60 * 15,
    },
    {
      id: '7',
      type: 'clipboard_copied',
      category: 'clipboard',
      title: 'Added to clipboard',
      description: 'Copied code block (156 characters)',
      icon: 'clipboard',
      color: 'slate',
      importance: 'low',
      metadata: {},
      timestamp: now - 1000 * 60 * 5,
    },
  ];
}

// ============== HELPER FUNCTIONS ==============

function getIconComponent(icon: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    'folder-plus': <FolderPlus className="w-4 h-4" />,
    'folder-open': <FolderOpen className="w-4 h-4" />,
    refresh: <RefreshCw className="w-4 h-4" />,
    upload: <Upload className="w-4 h-4" />,
    download: <Download className="w-4 h-4" />,
    'sticky-note': <StickyNote className="w-4 h-4" />,
    'check-square': <SquareCheck className="w-4 h-4" />,
    code: <Code className="w-4 h-4" />,
    clipboard: <Clipboard className="w-4 h-4" />,
    star: <Star className="w-4 h-4" />,
    pin: <Pin className="w-4 h-4" />,
    archive: <Archive className="w-4 h-4" />,
    trash: <Trash2 className="w-4 h-4" />,
    settings: <Settings className="w-4 h-4" />,
    sparkles: <Sparkles className="w-4 h-4" />,
    zap: <Zap className="w-4 h-4" />,
    message: <MessageSquare className="w-4 h-4" />,
    file: <FileText className="w-4 h-4" />,
  };
  return icons[icon] || <History className="w-4 h-4" />;
}

function getColorClasses(color: string): string {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  };
  return colors[color] || colors.slate;
}

function getBorderColor(color: string): string {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 dark:border-blue-800',
    green: 'border-green-200 dark:border-green-800',
    purple: 'border-purple-200 dark:border-purple-800',
    orange: 'border-orange-200 dark:border-orange-800',
    cyan: 'border-cyan-200 dark:border-cyan-800',
    amber: 'border-amber-200 dark:border-amber-800',
    rose: 'border-rose-200 dark:border-rose-800',
    slate: 'border-slate-200 dark:border-slate-700',
  };
  return colors[color] || colors.slate;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (isYesterday) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ` ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function groupEventsByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const event of events) {
    const date = new Date(event.timestamp).toDateString();
    let label = date;

    if (date === today) label = 'Today';
    else if (date === yesterday) label = 'Yesterday';

    const existing = groups.get(label) || [];
    existing.push(event);
    groups.set(label, existing);
  }

  return groups;
}

// ============== COMPONENT ==============

export function Timeline({ isOpen, onClose, onProjectSelect, onExport, projectId }: TimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<TimelineFilter>({
    categories: [],
    importance: [],
    search: '',
    dateRange: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Load events
  useEffect(() => {
    if (!isOpen) return;

    const loadEvents = async () => {
      setIsLoading(true);
      // Mock loading delay
      await new Promise((r) => setTimeout(r, 300));
      setEvents(generateMockEvents());
      setIsLoading(false);
    };

    loadEvents();
  }, [isOpen, projectId]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by categories
    if (filter.categories.length > 0) {
      filtered = filtered.filter((e) => filter.categories.includes(e.category));
    }

    // Filter by importance
    if (filter.importance.length > 0) {
      filtered = filtered.filter((e) => filter.importance.includes(e.importance));
    }

    // Filter by search
    if (filter.search) {
      const q = filter.search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.projectName?.toLowerCase().includes(q)
      );
    }

    // Filter by date range
    if (filter.dateRange && filter.dateRange !== 'all') {
      const now = Date.now();
      let cutoff = 0;

      switch (filter.dateRange) {
        case 'today':
          cutoff = now - 86400000;
          break;
        case 'week':
          cutoff = now - 604800000;
          break;
        case 'month':
          cutoff = now - 2592000000;
          break;
      }

      filtered = filtered.filter((e) => e.timestamp >= cutoff);
    }

    // Filter by project
    if (filter.projectId) {
      filtered = filtered.filter((e) => e.projectId === filter.projectId);
    }

    return filtered;
  }, [events, filter]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    return groupEventsByDate(filteredEvents);
  }, [filteredEvents]);

  const categoryFilters: { category: TimelineCategory; label: string }[] = [
    { category: 'project', label: 'Projects' },
    { category: 'conversation', label: 'Conversations' },
    { category: 'ai', label: 'AI' },
    { category: 'file', label: 'Files' },
    { category: 'note', label: 'Notes' },
    { category: 'task', label: 'Tasks' },
    { category: 'snippet', label: 'Snippets' },
  ];

  const toggleCategoryFilter = (category: TimelineCategory) => {
    setFilter((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex bg-omni-50 dark:bg-omni-950"
      >
        {/* Sidebar */}
        <div className="w-80 border-r border-omni-200 dark:border-omni-800 bg-white dark:bg-omni-900 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-omni-200 dark:border-omni-800">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-omni-700" />
              <h2 className="text-lg font-semibold text-omni-900">Timeline</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-omni-400 hover:text-omni-600 rounded-lg hover:bg-omni-100"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="px-4 py-3 border-b border-omni-200 dark:border-omni-800">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-omni-400" />
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search events..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-omni-200 dark:border-omni-700 bg-omni-50 dark:bg-omni-800 text-omni-900 dark:text-omni-100 placeholder:text-omni-400 focus:border-omni-500 focus:outline-none focus:ring-2 focus:ring-omni-400/20"
              />
            </div>

            <div className="flex items-center gap-2 mb-3">
              {(['Today', 'Week', 'Month', 'All'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setFilter((f) => ({ ...f, dateRange: range.toLowerCase() as TimelineFilter['dateRange'] }))}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full transition-colors',
                    filter.dateRange === range.toLowerCase()
                      ? 'bg-omni-900 text-white'
                      : 'bg-omni-100 dark:bg-omni-800 text-omni-600 dark:text-omni-300 hover:bg-omni-200'
                  )}
                >
                  {range}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categoryFilters.map(({ category, label }) => (
                <button
                  key={category}
                  onClick={() => toggleCategoryFilter(category)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg transition-colors',
                    filter.categories.includes(category)
                      ? 'bg-omni-900 text-white'
                      : 'bg-omni-100 dark:bg-omni-800 text-omni-600 dark:text-omni-300 hover:bg-omni-200'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="px-4 py-3 border-b border-omni-200 dark:border-omni-800">
            <div className="text-sm text-omni-500">
              {filteredEvents.length} events
              {filter.categories.length > 0 && ` in ${filter.categories.length} categories`}
            </div>
          </div>

          {/* Export Button */}
          <div className="p-4 mt-auto border-t border-omni-200 dark:border-omni-800">
            <button
              onClick={onExport}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-omni-900 text-white hover:bg-omni-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Timeline
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-omni-300 border-t-omni-900 rounded-full animate-spin" />
                <p className="text-sm text-omni-500">Loading timeline...</p>
              </div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <History className="w-10 h-10 mx-auto mb-3 text-omni-300" />
                <p className="text-omni-600 font-medium">No events found</p>
                <p className="text-sm text-omni-400 mt-1">
                  Try adjusting your filters
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-8 px-6">
              {Array.from(groupedEvents.entries()).map(([date, dateEvents]) => (
                <div key={date} className="mb-8">
                  {/* Date Header */}
                  <div className="sticky top-0 z-10 flex items-center gap-3 mb-4 py-2 bg-omni-50 dark:bg-omni-950">
                    <div className="flex items-center gap-2 text-sm font-medium text-omni-600">
                      <Calendar className="w-4 h-4" />
                      {date}
                    </div>
                    <div className="flex-1 h-px bg-omni-200 dark:bg-omni-800" />
                    <span className="text-xs text-omni-400">{dateEvents.length} events</span>
                  </div>

                  {/* Event Cards */}
                  <div className="space-y-3">
                    {dateEvents.map((event, idx) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={cn(
                          'relative pl-8 pb-4',
                          idx < dateEvents.length - 1 && 'border-l-2 border-omni-200 dark:border-omni-800 ml-4'
                        )}
                      >
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            'absolute left-0 top-0 w-4 h-4 rounded-full border-2 border-white dark:border-omni-900',
                            getColorClasses(event.color).split(' ')[0]
                          )}
                        />

                        {/* Event Card */}
                        <div
                          className={cn(
                            'rounded-xl border p-4 bg-white dark:bg-omni-900 transition-all cursor-pointer hover:shadow-md',
                            getBorderColor(event.color),
                            selectedEventId === event.id && 'ring-2 ring-omni-400'
                          )}
                          onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', getColorClasses(event.color))}>
                              {getIconComponent(event.icon)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-omni-900 dark:text-omni-100">
                                  {event.title}
                                </span>
                                {event.importance === 'high' && (
                                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                                )}
                              </div>
                              <div className="text-sm text-omni-600 dark:text-omni-300">
                                {event.description}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs text-omni-400">
                                {event.projectName && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onProjectSelect?.(event.projectId!);
                                    }}
                                    className="flex items-center gap-1 hover:text-omni-600"
                                  >
                                    <FolderOpen className="w-3 h-3" />
                                    {event.projectName}
                                  </button>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatRelativeTime(event.timestamp)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Expanded details */}
                          <AnimatePresence>
                            {selectedEventId === event.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 pt-4 border-t border-omni-200 dark:border-omni-700">
                                  <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                      <div className="text-omni-400 mb-1">Event ID</div>
                                      <div className="font-mono text-omni-600 dark:text-omni-300">{event.id.slice(0, 8)}</div>
                                    </div>
                                    <div>
                                      <div className="text-omni-400 mb-1">Category</div>
                                      <div className="text-omni-600 dark:text-omni-300 capitalize">{event.category}</div>
                                    </div>
                                    <div>
                                      <div className="text-omni-400 mb-1">Exact Time</div>
                                      <div className="font-mono text-omni-600 dark:text-omni-300">
                                        {formatTime(event.timestamp)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-omni-400 mb-1">Importance</div>
                                      <div className="text-omni-600 dark:text-omni-300 capitalize">{event.importance}</div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============== SHORTCUT HOOK ==============

export function useTimelineShortcut(onOpen: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+T (Timeline)
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        onOpen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpen, enabled]);
}
