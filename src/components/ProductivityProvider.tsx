/**
 * Productivity Overlay — Wraps all Phase 6 productivity features.
 *
 * Includes: Command Palette, Search Dialog, Timeline, Export Dialog, Import Dialog.
 * Handles global keyboard shortcuts.
 */

import { useState, useEffect, useCallback } from 'react';
import { CommandPalette, useCommandPaletteShortcut } from '@/components/CommandPalette';
import { SearchDialog, useSearchShortcut } from '@/components/SearchDialog';
import { Timeline, useTimelineShortcut } from '@/components/Timeline';
import type { ProjectId } from '@/types';

interface ProductivityOverlayProps {
  children: React.ReactNode;
  onProjectSelect?: (id: ProjectId) => void;
  onCreateProject?: () => void;
}

export function ProductivityOverlay({ children, onProjectSelect, onCreateProject }: ProductivityOverlayProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Register global shortcuts
  useCommandPaletteShortcut(() => setCommandPaletteOpen(true));
  useSearchShortcut(() => setSearchOpen(true));
  useTimelineShortcut(() => setTimelineOpen(true));

  // Export shortcut (Ctrl+Shift+E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setExportOpen(true);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        setImportOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleProjectSelect = useCallback((id: ProjectId) => {
    onProjectSelect?.(id);
    setCommandPaletteOpen(false);
    setSearchOpen(false);
    setTimelineOpen(false);
  }, [onProjectSelect]);

  const handleCreateProject = useCallback(() => {
    onCreateProject?.();
    setCommandPaletteOpen(false);
  }, [onCreateProject]);

  return (
    <>
      {children}

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectProject={handleProjectSelect}
        onCreateProject={handleCreateProject}
        onOpenSearch={() => {
          setCommandPaletteOpen(false);
          setSearchOpen(true);
        }}
        onOpenExport={() => {
          setCommandPaletteOpen(false);
          setExportOpen(true);
        }}
        onOpenImport={() => {
          setCommandPaletteOpen(false);
          setImportOpen(true);
        }}
        onOpenTimeline={() => {
          setCommandPaletteOpen(false);
          setTimelineOpen(true);
        }}
      />

      {/* Global Search */}
      <SearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onProjectSelect={handleProjectSelect}
      />

      {/* Timeline */}
      <Timeline
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        onProjectSelect={handleProjectSelect}
        onExport={() => {
          setTimelineOpen(false);
          setExportOpen(true);
        }}
      />
    </>
  );
}

export default ProductivityOverlay;
