/**
 * Global Search Dialog — Full-text search with grouped results and highlighted matches.
 *
 * Keyboard shortcut: Ctrl+Shift+K
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils';
import {
  Search,
  FolderOpen,
  MessageSquare,
  FileText,
  StickyNote,
  SquareCheck,
  Code,
  Clipboard,
  Clock,
  Star,
  Pin,
  X,
  ArrowRight,
  CornerDownLeft,
  Filter,
  Check,
} from 'lucide-react';
import { highlightMatch } from '@/engines/search';
import type { SearchableType, SearchEntry } from '@/engines/search';
import type { ProjectId } from '@/types';

// ============== TYPES ==============

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onResultSelect?: (result: SearchEntry) => void;
  onProjectSelect?: (id: ProjectId) => void;
  initialQuery?: string;
}

interface SearchFilterState {
  types: SearchableType[];
  projectId?: string;
  dateRange?: 'today' | 'week' | 'month' | 'all';
}

// ============== MOCK SEARCH ENGINE ==============

// In a real implementation, this would use the actual SearchEngine
// For now, we'll create a mock that simulates search results
const mockSearchResults: SearchEntry[] = [
  {
    id: '1',
    type: 'project',
    itemId: 'p1',
    projectId: null,
    title: 'AI Assistant Project',
    content: 'A project for building an AI assistant',
    preview: 'Building an AI assistant with Claude and ChatGPT',
    metadata: { platform: 'claude' },
    score: 50,
    accessCount: 10,
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: '2',
    type: 'conversation',
    itemId: 'c1',
    projectId: 'p1',
    title: 'Architecture Discussion',
    content: 'Discussion about the architecture of the system',
    preview: 'We discussed the main components...',
    metadata: { platform: 'claude', model: 'claude-3-opus' },
    score: 40,
    accessCount: 5,
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: '3',
    type: 'note',
    itemId: 'n1',
    projectId: 'p1',
    title: 'Meeting Notes',
    content: 'Notes from the team meeting about roadmap',
    preview: 'Q2 roadmap planning session...',
    metadata: {},
    score: 30,
    accessCount: 3,
    timestamp: Date.now() - 1000 * 60 * 30,
  },
  {
    id: '4',
    type: 'task',
    itemId: 't1',
    projectId: 'p1',
    title: 'Implement search feature',
    content: 'Implement the global search functionality',
    preview: 'Create search dialog with fuzzy matching...',
    metadata: { status: 'in_progress', priority: 'high' },
    score: 35,
    accessCount: 8,
    timestamp: Date.now() - 1000 * 60 * 60 * 4,
  },
  {
    id: '5',
    type: 'snippet',
    itemId: 's1',
    projectId: 'p1',
    title: 'Search Fuzzy Match',
    content: 'function fuzzyMatch(pattern, text) { ... }',
    preview: 'Pattern matching for fuzzy search...',
    metadata: { language: 'typescript' },
    score: 25,
    accessCount: 2,
    timestamp: Date.now() - 1000 * 60 * 60,
  },
];

async function mockSearch(query: string, filters: SearchFilterState): Promise<SearchEntry[]> {
  const q = query.toLowerCase();

  if (!q) return mockSearchResults;

  return mockSearchResults.filter((entry) => {
    const titleMatch = entry.title.toLowerCase().includes(q);
    const contentMatch = entry.content.toLowerCase().includes(q);
    const typeMatch = filters.types.length === 0 || filters.types.includes(entry.type);

    return (titleMatch || contentMatch) && typeMatch;
  });
}

// ============== COMPONENT ==============

export function SearchDialog({
  isOpen,
  onClose,
  onResultSelect,
  onProjectSelect,
  initialQuery = '',
}: SearchDialogProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilterState>({
    types: [],
    dateRange: 'all',
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialQuery]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!isOpen) return;

    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchResults = await mockSearch(query, filters);
        setResults(searchResults);

        // Generate suggestions based on results
        if (query.length >= 2) {
          const suggs = searchResults
            .slice(0, 3)
            .map((r) => r.title);
          setSuggestions(suggs);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [query, filters, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          const selected = results[selectedIndex];
          if (selected) {
            handleResultSelect(selected);
          }
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  const handleResultSelect = useCallback((result: SearchEntry) => {
    onResultSelect?.(result);

    if (result.type === 'project' && result.itemId && onProjectSelect) {
      onProjectSelect(result.itemId as ProjectId);
    }

    onClose();
  }, [onResultSelect, onProjectSelect, onClose]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Map<SearchableType, SearchEntry[]> = new Map();

    for (const result of results) {
      const existing = groups.get(result.type) || [];
      existing.push(result);
      groups.set(result.type, existing);
    }

    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      label: getTypeLabel(type),
      icon: getTypeIcon(type),
      color: getTypeColor(type),
      results: items,
    }));
  }, [results]);

  const typeFilters: { type: SearchableType; label: string; icon: React.ReactNode }[] = [
    { type: 'project', label: 'Projects', icon: <FolderOpen className="w-4 h-4" /> },
    { type: 'conversation', label: 'Conversations', icon: <MessageSquare className="w-4 h-4" /> },
    { type: 'note', label: 'Notes', icon: <StickyNote className="w-4 h-4" /> },
    { type: 'task', label: 'Tasks', icon: <SquareCheck className="w-4 h-4" /> },
    { type: 'snippet', label: 'Snippets', icon: <Code className="w-4 h-4" /> },
    { type: 'file', label: 'Files', icon: <FileText className="w-4 h-4" /> },
  ];

  const toggleTypeFilter = (type: SearchableType) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-2xl bg-white dark:bg-omni-900 rounded-xl shadow-2xl border border-omni-200 dark:border-omni-700 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-omni-200 dark:border-omni-700">
            <Search className="w-5 h-5 text-omni-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search everything..."
              className="flex-1 bg-transparent text-omni-900 dark:text-omni-100 placeholder:text-omni-400 text-base outline-none"
            />
            {isSearching && (
              <div className="w-4 h-4 border-2 border-omni-300 border-t-omni-600 rounded-full animate-spin" />
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showFilters || filters.types.length > 0
                  ? 'bg-omni-100 text-omni-700'
                  : 'text-omni-400 hover:bg-omni-50'
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-omni-400 hover:text-omni-600 rounded-lg hover:bg-omni-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filters Dropdown */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-omni-200 dark:border-omni-700"
              >
                <div className="px-4 py-3">
                  <div className="text-xs font-medium text-omni-500 mb-2">Filter by type</div>
                  <div className="flex flex-wrap gap-2">
                    {typeFilters.map(({ type, label, icon }) => (
                      <button
                        key={type}
                        onClick={() => toggleTypeFilter(type)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                          filters.types.includes(type)
                            ? 'bg-omni-900 text-white'
                            : 'bg-omni-100 text-omni-700 hover:bg-omni-200'
                        )}
                      >
                        {icon}
                        {label}
                        {filters.types.includes(type) && (
                          <Check className="w-3 h-3" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggestions */}
          {suggestions.length > 0 && query && (
            <div className="px-4 py-2 border-b border-omni-100 dark:border-omni-800 bg-omni-50 dark:bg-omni-800/50">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-omni-400">Did you mean:</span>
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(suggestion)}
                    className="text-omni-700 hover:text-omni-900 underline"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {results.length === 0 && query && !isSearching ? (
              <div className="py-12 text-center">
                <Search className="w-10 h-10 mx-auto mb-3 text-omni-300" />
                <p className="text-omni-600 font-medium">No results found</p>
                <p className="text-sm text-omni-400 mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              groupedResults.map((group) => (
                <div key={group.type} className="py-2">
                  {/* Group Header */}
                  <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-omni-500 uppercase tracking-wider">
                    <div className={cn('w-5 h-5 rounded flex items-center justify-center', group.color)}>
                      {group.icon}
                    </div>
                    <span>{group.label}</span>
                    <span className="ml-auto text-omni-400">{group.results.length}</span>
                  </div>

                  {/* Group Results */}
                  {group.results.map((result) => {
                    const globalIdx = results.indexOf(result);
                    const isSelected = globalIdx === selectedIndex;

                    return (
                      <button
                        key={result.id}
                        data-index={globalIdx}
                        onClick={() => handleResultSelect(result)}
                        className={cn(
                          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                          isSelected
                            ? 'bg-omni-100 dark:bg-omni-800'
                            : 'hover:bg-omni-50 dark:hover:bg-omni-800/50'
                        )}
                      >
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', group.color)}>
                          {group.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-medium text-omni-900 dark:text-omni-100"
                            dangerouslySetInnerHTML={{
                              __html: result.title,
                            }}
                          />
                          <div className="text-xs text-omni-500 mt-0.5 line-clamp-2">
                            {result.preview}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-omni-400">
                            {result.projectId && (
                              <span className="flex items-center gap-1">
                                <FolderOpen className="w-3 h-3" />
                                Project
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(result.timestamp)}
                            </span>
                            {result.accessCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                {result.accessCount} views
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <ArrowRight className="w-4 h-4 text-omni-400 shrink-0 mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}

            {/* Empty State */}
            {!query && results.length === 0 && (
              <div className="py-12 text-center">
                <Search className="w-10 h-10 mx-auto mb-3 text-omni-300" />
                <p className="text-omni-600 font-medium">Start typing to search</p>
                <p className="text-sm text-omni-400 mt-1">
                  Search projects, conversations, notes, tasks, and more
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-omni-200 dark:border-omni-700 bg-omni-50 dark:bg-omni-800/50">
            <div className="flex items-center gap-4 text-xs text-omni-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-omni-100 dark:bg-omni-700 font-mono">
                  ↑
                </kbd>
                <kbd className="px-1 py-0.5 rounded bg-omni-100 dark:bg-omni-700 font-mono">
                  ↓
                </kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-omni-100 dark:bg-omni-700 font-mono">
                  enter
                </kbd>
                to open
              </span>
            </div>
            <div className="text-xs text-omni-400">
              {results.length} results
              {filters.types.length > 0 && ` in ${filters.types.length} types`}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============== HELPERS ==============

function getTypeLabel(type: SearchableType): string {
  const labels: Record<SearchableType, string> = {
    project: 'Projects',
    conversation: 'Conversations',
    message: 'Messages',
    file: 'Files',
    note: 'Notes',
    task: 'Tasks',
    snippet: 'Snippets',
    clipboard: 'Clipboard',
    timeline: 'Timeline',
    pinned: 'Pinned',
  };
  return labels[type];
}

function getTypeIcon(type: SearchableType): React.ReactNode {
  switch (type) {
    case 'project':
      return <FolderOpen className="w-4 h-4" />;
    case 'conversation':
    case 'message':
      return <MessageSquare className="w-4 h-4" />;
    case 'file':
      return <FileText className="w-4 h-4" />;
    case 'note':
      return <StickyNote className="w-4 h-4" />;
    case 'task':
      return <SquareCheck className="w-4 h-4" />;
    case 'snippet':
      return <Code className="w-4 h-4" />;
    case 'clipboard':
      return <Clipboard className="w-4 h-4" />;
    default:
      return <Star className="w-4 h-4" />;
  }
}

function getTypeColor(type: SearchableType): string {
  const colors: Record<SearchableType, string> = {
    project: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    conversation: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    message: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    file: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    note: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    task: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    snippet: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    clipboard: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    timeline: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    pinned: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  return colors[type];
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

// ============== KEYBOARD SHORTCUT HOOK ==============

export function useSearchShortcut(onOpen: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+K (Global Search)
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        onOpen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpen, enabled]);
}
