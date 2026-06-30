import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectStore } from '@/state';
import { ProjectCard } from '@/components/ProjectCard';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { EditProjectModal } from '@/components/EditProjectModal';
import { DeleteProjectModal } from '@/components/DeleteProjectModal';
import { ProjectDetails } from '@/components/ProjectDetails';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Badge } from '@/ui/Badge';
import { ProjectId, ProjectFilter, ProjectSort } from '@/types';
import { cn, formatDate } from '@/utils';
import { Plus, Search, Pin, Star, Archive, Clock, LayoutGrid, List, Trash2, ArrowUpDown, FolderOpen, Zap, TrendingUp, MessageSquare, FileText, StickyNote, SquareCheck as CheckSquare } from 'lucide-react';

export function ProjectDashboard() {
  const {
    projects, filteredProjects, stats, isLoading, error,
    recentProjects, pinnedProjects, favoriteProjects, archivedProjects,
    searchQuery, loadProjects, setSearchQuery, setSelectedProject,
    softDeleteProject, restoreProject, toggleFavorite, togglePin, toggleArchive, openProject,
  } = useProjectStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<ProjectId | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<ProjectId | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'permanent'>('soft');
  const [selectedId, setSelectedId] = useState<ProjectId | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setCreateOpen(true);
      }
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        setShowSearch(true);
        const el = document.getElementById('project-search');
        el?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleOpen = useCallback(async (id: ProjectId) => {
    await openProject(id);
    setSelectedId(id);
    setSelectedProject(id);
  }, [openProject, setSelectedProject]);

  const handleEdit = useCallback((id: ProjectId) => {
    setEditId(id);
    setEditOpen(true);
  }, []);

  const handleDelete = useCallback((id: ProjectId) => {
    setDeleteId(id);
    setDeleteMode('soft');
    setDeleteOpen(true);
  }, []);

  const handleToggleFavorite = useCallback(async (id: ProjectId) => {
    await toggleFavorite(id);
  }, [toggleFavorite]);

  const handleTogglePin = useCallback(async (id: ProjectId) => {
    await togglePin(id);
  }, [togglePin]);

  const handleToggleArchive = useCallback(async (id: ProjectId) => {
    await toggleArchive(id);
  }, [toggleArchive]);

  const handleCloseDetails = useCallback(() => {
    setSelectedId(null);
    setSelectedProject(null);
  }, [setSelectedProject]);

  const filterButtons: { value: ProjectFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'All', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { value: 'favorites', label: 'Favorites', icon: <Star className="w-3.5 h-3.5" /> },
    { value: 'pinned', label: 'Pinned', icon: <Pin className="w-3.5 h-3.5" /> },
    { value: 'archived', label: 'Archived', icon: <Archive className="w-3.5 h-3.5" /> },
    { value: 'recent', label: 'Recent', icon: <Clock className="w-3.5 h-3.5" /> },
  ];

  const sortOptions: { value: ProjectSort; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'recently-opened', label: 'Recently Opened' },
    { value: 'alphabetical', label: 'Alphabetical' },
    { value: 'most-active', label: 'Most Active' },
  ];

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-omni-300 border-t-omni-900 rounded-full animate-spin" />
          <p className="text-sm text-omni-500">Loading projects...</p>
        </div>
      </div>
    );
  }

  const selectedProject = selectedId ? projects.find((p) => p.id === selectedId) : null;

  return (
    <div className="min-h-screen bg-omni-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-omni-900">Projects</h1>
            <p className="text-sm text-omni-500 mt-0.5">
              {stats.active} active · {stats.favorites} favorites · {stats.pinned} pinned
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white rounded-lg border border-omni-200 shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded-l-lg transition-colors',
                  viewMode === 'grid' ? 'bg-omni-100 text-omni-900' : 'text-omni-400 hover:text-omni-700'
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 rounded-r-lg transition-colors',
                  viewMode === 'list' ? 'bg-omni-100 text-omni-900' : 'text-omni-400 hover:text-omni-700'
                )}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              icon={<Plus className="w-4 h-4" />}
              size="md"
            >
              New Project
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-omni-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <FolderOpen className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-omni-900">{stats.active}</div>
                <div className="text-xs text-omni-500">Active Projects</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-omni-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <MessageSquare className="w-4.5 h-4.5 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-omni-900">{stats.totalConversations}</div>
                <div className="text-xs text-omni-500">Conversations</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-omni-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <StickyNote className="w-4.5 h-4.5 text-purple-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-omni-900">{stats.totalNotes}</div>
                <div className="text-xs text-omni-500">Notes</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-omni-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <CheckSquare className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-omni-900">{stats.totalTasks}</div>
                <div className="text-xs text-omni-500">Tasks</div>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="flex-1 w-full sm:w-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-omni-400" />
            <input
              id="project-search"
              value={searchQuery.text}
              onChange={(e) => setSearchQuery({ text: e.target.value })}
              placeholder="Search projects..."
              className={cn(
                'w-full rounded-lg border border-omni-200 bg-white pl-10 pr-3 py-2 text-sm text-omni-900 placeholder:text-omni-400',
                'focus:border-omni-500 focus:outline-none focus:ring-2 focus:ring-omni-400/20'
              )}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterButtons.map((f) => (
              <button
                key={f.value}
                onClick={() => setSearchQuery({ filter: f.value })}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  searchQuery.filter === f.value
                    ? 'bg-omni-900 text-white'
                    : 'bg-white text-omni-600 border border-omni-200 hover:bg-omni-50'
                )}
                aria-pressed={searchQuery.filter === f.value}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-omni-400">Sort:</span>
            <select
              value={searchQuery.sort}
              onChange={(e) => setSearchQuery({ sort: e.target.value as ProjectSort })}
              className="rounded-lg border border-omni-200 bg-white px-2 py-1.5 text-xs text-omni-700 focus:border-omni-500 focus:outline-none"
            >
              {sortOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center justify-between"
            >
              <span>{error}</span>
              <button
                onClick={() => useProjectStore.getState().clearError()}
                className="text-red-500 hover:text-red-700 font-medium"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {projects.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-omni-100 flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-omni-400" />
            </div>
            <h2 className="text-lg font-semibold text-omni-900 mb-1">No projects yet</h2>
            <p className="text-sm text-omni-500 mb-6 max-w-sm">
              Create your first project to start organizing your AI conversations, notes, and files.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              icon={<Plus className="w-4 h-4" />}
              size="lg"
            >
              Create Project
            </Button>
          </div>
        )}

        {/* Pinned Section */}
        {pinnedProjects.length > 0 && searchQuery.filter === 'all' && !searchQuery.text && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-omni-700 mb-3 flex items-center gap-1.5">
              <Pin className="w-4 h-4 text-accent-amber" />
              Pinned
            </h2>
            <div className={cn(
              'gap-3',
              viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'
            )}>
              <AnimatePresence mode="popLayout">
                {pinnedProjects.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    index={i}
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleFavorite={handleToggleFavorite}
                    onTogglePin={handleTogglePin}
                    onToggleArchive={handleToggleArchive}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Favorites Section */}
        {favoriteProjects.length > 0 && searchQuery.filter === 'all' && !searchQuery.text && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-omni-700 mb-3 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-accent-amber" />
              Favorites
            </h2>
            <div className={cn(
              'gap-3',
              viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'
            )}>
              <AnimatePresence mode="popLayout">
                {favoriteProjects.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    index={i}
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleFavorite={handleToggleFavorite}
                    onTogglePin={handleTogglePin}
                    onToggleArchive={handleToggleArchive}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Recent Section */}
        {recentProjects.length > 0 && searchQuery.filter === 'all' && !searchQuery.text && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-omni-700 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-omni-500" />
              Recently Opened
            </h2>
            <div className={cn(
              'gap-3',
              viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'
            )}>
              <AnimatePresence mode="popLayout">
                {recentProjects.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    index={i}
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleFavorite={handleToggleFavorite}
                    onTogglePin={handleTogglePin}
                    onToggleArchive={handleToggleArchive}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* All / Filtered Projects */}
        {filteredProjects.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-omni-700 mb-3 flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-omni-500" />
              {searchQuery.filter === 'all' && !searchQuery.text ? 'All Projects' : 'Results'}
              <Badge variant="neutral" size="sm">{filteredProjects.length}</Badge>
            </h2>
            <div className={cn(
              'gap-3',
              viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'
            )}>
              <AnimatePresence mode="popLayout">
                {filteredProjects.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    index={i}
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleFavorite={handleToggleFavorite}
                    onTogglePin={handleTogglePin}
                    onToggleArchive={handleToggleArchive}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          projects.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="w-8 h-8 text-omni-300 mb-2" />
              <p className="text-sm text-omni-500">No projects match your search</p>
              <button
                onClick={() => setSearchQuery({ text: '', filter: 'all', sort: 'newest' })}
                className="mt-2 text-sm text-omni-700 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )
        )}

        {/* Archived Projects (when on archived filter) */}
        {searchQuery.filter === 'archived' && archivedProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Archive className="w-8 h-8 text-omni-300 mb-2" />
            <p className="text-sm text-omni-500">No archived projects</p>
          </div>
        )}
      </div>

      {/* Project Details Panel */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectDetails
            project={selectedProject}
            onClose={handleCloseDetails}
            onEdit={() => handleEdit(selectedProject.id)}
            onDelete={() => handleDelete(selectedProject.id)}
            onToggleFavorite={() => handleToggleFavorite(selectedProject.id)}
            onTogglePin={() => handleTogglePin(selectedProject.id)}
            onToggleArchive={() => handleToggleArchive(selectedProject.id)}
            onRestore={() => restoreProject(selectedProject.id)}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <CreateProjectModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditProjectModal isOpen={editOpen} projectId={editId} onClose={() => setEditOpen(false)} />
      <DeleteProjectModal isOpen={deleteOpen} projectId={deleteId} onClose={() => setDeleteOpen(false)} mode={deleteMode} />
    </div>
  );
}
