/**
 * Command Palette — VS Code/Raycast inspired command interface.
 *
 * Keyboard shortcut: Ctrl+Shift+P
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils';
import {
  Search,
  Plus,
  FolderOpen,
  MessageSquare,
  FileText,
  StickyNote,
  SquareCheck,
  Code,
  Upload,
  Download,
  Settings,
  Moon,
  Sun,
  Keyboard,
  Clock,
  Star,
  Pin,
  Archive,
  Trash2,
  LayoutDashboard,
  History,
  FileCode,
  ArrowRight,
  Command,
  CornerDownLeft,
} from 'lucide-react';
import { useProjectStore } from '@/state';
import type { ProjectId } from '@/types';

// ============== TYPES ==============

type CommandCategory = 'navigation' | 'creation' | 'action' | 'search' | 'export' | 'settings' | 'view';

interface Command {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
  keywords?: string[];
}

interface CommandGroup {
  category: CommandCategory;
  label: string;
  commands: Command[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject?: (id: ProjectId) => void;
  onCreateProject?: () => void;
  onOpenSearch?: () => void;
  onOpenExport?: () => void;
  onOpenImport?: () => void;
  onOpenTimeline?: () => void;
  onOpenSettings?: () => void;
}

// ============== FUZZY SEARCH ==============

function fuzzyMatch(pattern: string, text: string): boolean {
  const p = pattern.toLowerCase();
  const t = text.toLowerCase();

  // Exact match
  if (t.includes(p)) return true;

  // Fuzzy: pattern chars must appear in order
  let patternIndex = 0;
  for (let i = 0; i < t.length && patternIndex < p.length; i++) {
    if (t[i] === p[patternIndex]) {
      patternIndex++;
    }
  }

  return patternIndex === p.length;
}

function scoreCommand(command: Command, query: string): number {
  const q = query.toLowerCase();
  const labelLower = command.label.toLowerCase();
  const descLower = command.description?.toLowerCase() || '';
  const keywords = command.keywords?.join(' ').toLowerCase() || '';

  // Exact label match (highest)
  if (labelLower === q) return 100;

  // Label starts with query
  if (labelLower.startsWith(q)) return 80;

  // Query appears in label
  if (labelLower.includes(q)) return 60;

  // Query appears in description
  if (descLower.includes(q)) return 40;

  // Fuzzy match label
  if (fuzzyMatch(q, labelLower)) return 20;

  // Fuzzy match description
  if (fuzzyMatch(q, descLower)) return 10;

  // Match keywords
  if (keywords && fuzzyMatch(q, keywords)) return 15;

  return 0;
}

// ============== COMPONENT ==============

export function CommandPalette({
  isOpen,
  onClose,
  onSelectProject,
  onCreateProject,
  onOpenSearch,
  onOpenExport,
  onOpenImport,
  onOpenTimeline,
  onOpenSettings,
}: CommandPaletteProps) {
  const { projects, recentProjects } = useProjectStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset query when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Define commands
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];

    // Creation commands
    cmds.push({
      id: 'create-project',
      label: 'Create Project',
      description: 'Create a new project',
      category: 'creation',
      icon: <Plus className="w-4 h-4" />,
      shortcut: 'Ctrl+N',
      action: () => {
        onClose();
        onCreateProject?.();
      },
      keywords: ['new', 'add', 'project'],
    });

    // Navigation commands - Recent projects
    recentProjects.slice(0, 5).forEach((project, i) => {
      cmds.push({
        id: `open-recent-${project.id}`,
        label: `Open ${project.name}`,
        description: 'Recent project',
        category: 'navigation',
        icon: <Clock className="w-4 h-4" />,
        shortcut: i < 9 ? `Ctrl+${i + 1}` : undefined,
        action: () => {
          onClose();
          onSelectProject?.(project.id);
        },
        keywords: ['open', 'project', 'recent'],
      });
    });

    // Search commands
    cmds.push({
      id: 'search-everything',
      label: 'Search Everything',
      description: 'Search across all content',
      category: 'search',
      icon: <Search className="w-4 h-4" />,
      shortcut: 'Ctrl+Shift+K',
      action: () => {
        onClose();
        onOpenSearch?.();
      },
      keywords: ['find', 'lookup', 'global'],
    });

    // Export/Import commands
    cmds.push({
      id: 'export',
      label: 'Export Workspace',
      description: 'Export data to various formats',
      category: 'export',
      icon: <Download className="w-4 h-4" />,
      shortcut: 'Ctrl+Shift+E',
      action: () => {
        onClose();
        onOpenExport?.();
      },
      keywords: ['download', 'save', 'backup'],
    });

    cmds.push({
      id: 'import',
      label: 'Import Data',
      description: 'Import from file',
      category: 'export',
      icon: <Upload className="w-4 h-4" />,
      shortcut: 'Ctrl+Shift+I',
      action: () => {
        onClose();
        onOpenImport?.();
      },
      keywords: ['upload', 'load', 'restore'],
    });

    // View commands
    cmds.push({
      id: 'timeline',
      label: 'View Timeline',
      description: 'View activity timeline',
      category: 'view',
      icon: <History className="w-4 h-4" />,
      shortcut: 'Ctrl+Shift+T',
      action: () => {
        onClose();
        onOpenTimeline?.();
      },
      keywords: ['activity', 'history', 'events'],
    });

    cmds.push({
      id: 'dashboard',
      label: 'Go to Dashboard',
      description: 'Return to main dashboard',
      category: 'view',
      icon: <LayoutDashboard className="w-4 h-4" />,
      action: () => {
        onClose();
      },
      keywords: ['home', 'main', 'projects'],
    });

    // Settings commands
    cmds.push({
      id: 'settings',
      label: 'Open Settings',
      description: 'Manage preferences and settings',
      category: 'settings',
      icon: <Settings className="w-4 h-4" />,
      action: () => {
        onClose();
        onOpenSettings?.();
      },
      keywords: ['preferences', 'config', 'options'],
    });

    return cmds;
  }, [
    recentProjects,
    onCreateProject,
    onClose,
    onOpenSearch,
    onOpenExport,
    onOpenImport,
    onOpenTimeline,
    onOpenSettings,
    onSelectProject,
  ]);

  // Filter and sort commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const scored = commands
      .map((cmd) => ({ ...cmd, score: scoreCommand(cmd, query) }))
      .filter((cmd) => cmd.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored;
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Map<CommandCategory, Command[]> = new Map();

    for (const cmd of filteredCommands) {
      const existing = groups.get(cmd.category) || [];
      existing.push(cmd);
      groups.set(cmd.category, existing);
    }

    return Array.from(groups.entries()).map(([category, cmds]) => ({
      category,
      label: getCategoryLabel(category),
      commands: cmds,
    }));
  }, [filteredCommands]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          const selected = filteredCommands[selectedIndex];
          if (selected && !selected.disabled) {
            selected.action();
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
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;

    const selectedEl = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    );

    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Track recent commands for analytics
  const handleSelectCommand = useCallback((cmd: Command) => {
    // Track usage (would integrate with analytics engine)
    if (cmd.action) {
      cmd.action();
    }
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-white dark:bg-omni-900 rounded-xl shadow-2xl border border-omni-200 dark:border-omni-700 overflow-hidden"
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
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-omni-900 dark:text-omni-100 placeholder:text-omni-400 text-base outline-none"
            />
            <div className="flex items-center gap-1 text-xs text-omni-400">
              <kbd className="px-1.5 py-0.5 rounded bg-omni-100 dark:bg-omni-800 font-mono">
                <CornerDownLeft className="w-3 h-3" />
              </kbd>
              to select
            </div>
          </div>

          {/* Command List */}
          <div
            ref={listRef}
            className="max-h-[50vh] overflow-y-auto p-2"
            role="listbox"
          >
            {groupedCommands.length === 0 ? (
              <div className="py-8 text-center text-omni-400">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No commands found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              groupedCommands.map((group) => (
                <div key={group.category} className="mb-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-omni-500 uppercase tracking-wider">
                    {group.label}
                  </div>
                  {group.commands.map((cmd) => {
                    const globalIdx = filteredCommands.indexOf(cmd);
                    const isSelected = globalIdx === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        data-index={globalIdx}
                        onClick={() => handleSelectCommand(cmd)}
                        disabled={cmd.disabled}
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                          isSelected
                            ? 'bg-omni-100 dark:bg-omni-800'
                            : 'hover:bg-omni-50 dark:hover:bg-omni-800/50',
                          cmd.disabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center',
                            getCategoryColor(cmd.category)
                          )}
                        >
                          {cmd.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-omni-900 dark:text-omni-100 truncate">
                            {cmd.label}
                          </div>
                          {cmd.description && (
                            <div className="text-xs text-omni-500 truncate">
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <div className="hidden sm:flex items-center gap-1 text-xs text-omni-400">
                            <kbd className="px-1.5 py-0.5 rounded bg-omni-100 dark:bg-omni-800 font-mono">
                              {cmd.shortcut}
                            </kbd>
                          </div>
                        )}
                        {isSelected && (
                          <ArrowRight className="w-4 h-4 text-omni-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
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
                  esc
                </kbd>
                to close
              </span>
            </div>
            <div className="text-xs text-omni-400">
              {filteredCommands.length} commands
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============== HELPERS ==============

function getCategoryLabel(category: CommandCategory): string {
  const labels: Record<CommandCategory, string> = {
    navigation: 'Navigation',
    creation: 'Create New',
    action: 'Actions',
    search: 'Search',
    export: 'Export & Import',
    settings: 'Settings',
    view: 'View',
  };
  return labels[category];
}

function getCategoryColor(
  category: CommandCategory
): string {
  const colors: Record<CommandCategory, string> = {
    navigation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    creation: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    action: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    search: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    export: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    settings: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    view: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  };
  return colors[category];
}

// ============== KEYBOARD SHORTCUT HOOK ==============

export function useCommandPaletteShortcut(
  onOpen: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+P (Command Palette)
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        onOpen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpen, enabled]);
}
