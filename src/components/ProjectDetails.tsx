import { Project } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { cn, formatDate, formatFullDate } from '@/utils';
import { X, Star, Pin, Archive, Trash2, CreditCard as Edit, RotateCcw, MessageSquare, FileText, StickyNote, SquareCheck as CheckSquare, Clock, Calendar, Code, FileText as FileIcon, FlaskConical, Rocket, GraduationCap, Heart, Clipboard, Loader } from 'lucide-react';
import { useState, useEffect } from 'react';
import { WorkspaceProvider, useWorkspace } from '@/hooks/use-workspace';
import { FileLibraryTab } from '@/components/FileLibrary';
import { NotesTab } from '@/components/Notes';
import { TasksTab } from '@/components/Tasks';
import { SnippetsTab } from '@/components/Snippets';
import { ClipboardTab } from '@/components/Clipboard';
import { ConversationsTab } from '@/components/ConversationsTab';

interface ProjectDetailsProps {
  project: Project;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onRestore: () => void;
}

const templateIconMap: Record<string, React.ReactNode> = {
  software: <Code className="w-4 h-4" />,
  research: <FlaskConical className="w-4 h-4" />,
  startup: <Rocket className="w-4 h-4" />,
  college: <GraduationCap className="w-4 h-4" />,
  personal: <Heart className="w-4 h-4" />,
  blank: <FileIcon className="w-4 h-4" />,
};

type WorkspaceTab = 'conversations' | 'files' | 'notes' | 'tasks' | 'snippets' | 'clipboard';

const tabItems: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'conversations', label: 'Conversations', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'files', label: 'Files', icon: <FileText className="w-4 h-4" /> },
  { id: 'notes', label: 'Notes', icon: <StickyNote className="w-4 h-4" /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-4 h-4" /> },
  { id: 'snippets', label: 'Snippets', icon: <Code className="w-4 h-4" /> },
  { id: 'clipboard', label: 'Clipboard', icon: <Clipboard className="w-4 h-4" /> },
];

function WorkspaceTabsContent({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('files');
  const workspace = useWorkspace();

  if (!workspace.isReady) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-2">
          <Loader className="w-6 h-6 animate-spin text-omni-400" />
          <span className="text-sm text-omni-500">Loading workspace...</span>
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'files':
        return (
          <FileLibraryTab
            projectId={projectId}
            files={workspace.files}
            onUpload={workspace.uploadFiles}
            onFilePreview={async (file) => {
              const preview = await workspace.getFilePreview(file.id);
              if (preview) {
                console.log('Preview:', preview);
              }
            }}
            onFileDownload={(file) => workspace.downloadFile(file.id)}
            onFileDelete={(file) => workspace.deleteFile(file.id)}
            onFileFavorite={(file) => workspace.toggleFileFavorite(file.id)}
            onFilePin={(file) => workspace.toggleFilePinned(file.id)}
            loading={workspace.filesLoading}
          />
        );
      case 'notes':
        return (
          <NotesTab
            projectId={projectId}
            notes={workspace.notes}
            folders={[]}
            onCreateNote={(title) => workspace.createNote(title)}
            onUpdateNote={(noteId, title, content) => workspace.updateNote(noteId, title, content)}
            onDeleteNote={(noteId) => workspace.deleteNote(noteId)}
            onFavoriteNote={(noteId) => workspace.toggleNoteFavorite(noteId)}
            onPinNote={(noteId) => workspace.toggleNotePinned(noteId)}
            onArchiveNote={(noteId) => workspace.archiveNote(noteId)}
            autoSaveNote={(noteId, content) => workspace.autoSaveNote(noteId, content)}
            loading={workspace.notesLoading}
          />
        );
      case 'tasks':
        return (
          <TasksTab
            projectId={projectId}
            tasks={workspace.tasks}
            stats={workspace.taskStats}
            onCreateTask={async (title, status) => {
              const task = await workspace.createTask(title);
              if (task && status !== 'todo') {
                await workspace.updateTask(task.id, { status });
              }
            }}
            onUpdateTask={(taskId, updates) => workspace.updateTask(taskId, updates)}
            onDeleteTask={(taskId) => workspace.deleteTask(taskId)}
            onMoveTask={(taskId, newStatus, newPosition) => workspace.moveTask(taskId, newStatus, newPosition)}
            loading={workspace.tasksLoading}
          />
        );
      case 'snippets':
        return (
          <SnippetsTab
            projectId={projectId}
            snippets={workspace.snippets}
            folders={[]}
            onCreateSnippet={(title, code, type, language) => workspace.createSnippet(title, code, type, language)}
            onUpdateSnippet={(snippetId, updates) => workspace.updateSnippet(snippetId, updates)}
            onDeleteSnippet={(snippetId) => workspace.deleteSnippet(snippetId)}
            onCopySnippet={(snippetId) => workspace.copySnippet(snippetId)}
            loading={workspace.snippetsLoading}
          />
        );
      case 'clipboard':
        return (
          <ClipboardTab
            items={workspace.clipboardItems}
            onItemCopy={(itemId) => workspace.copyClipboardItem(itemId)}
            onItemDelete={(itemId) => workspace.deleteClipboardItem(itemId)}
            onItemFavorite={(itemId) => workspace.toggleClipboardFavorite(itemId)}
            onItemPin={(itemId) => workspace.toggleClipboardPinned(itemId)}
            onClearHistory={() => workspace.clearClipboardHistory()}
            loading={workspace.clipboardLoading}
          />
        );
      case 'conversations':
      default:
        return (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Conversations view coming soon</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b border-omni-100 mb-4">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "text-omni-900 border-omni-900"
                  : "text-omni-500 border-transparent hover:text-omni-700 hover:border-omni-200"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {renderTab()}
      </div>
    </div>
  );
}

export function ProjectDetails({
  project,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onToggleArchive,
  onRestore,
}: ProjectDetailsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-white shadow-2xl border-l border-omni-200 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-omni-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: project.color + '18' }}
            >
              <FileIcon className="w-5 h-5" style={{ color: project.color }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-omni-900 leading-tight">{project.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {project.isPinned && (
                  <Badge variant="warning" size="sm">
                    <Pin className="w-3 h-3 mr-0.5" /> Pinned
                  </Badge>
                )}
                {project.isFavorite && (
                  <Badge variant="warning" size="sm">
                    <Star className="w-3 h-3 mr-0.5 fill-accent-amber" /> Favorite
                  </Badge>
                )}
                {project.isArchived && (
                  <Badge variant="neutral" size="sm">
                    <Archive className="w-3 h-3 mr-0.5" /> Archived
                  </Badge>
                )}
                {project.isDeleted && (
                  <Badge variant="danger" size="sm">
                    <Trash2 className="w-3 h-3 mr-0.5" /> Deleted
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {project.isDeleted ? (
              <Button variant="secondary" size="sm" onClick={onRestore} icon={<RotateCcw className="w-4 h-4" />}>
                Restore
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleFavorite}
                  icon={<Star className={cn('w-4 h-4', project.isFavorite && 'fill-accent-amber text-accent-amber')} />}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onTogglePin}
                  icon={<Pin className={cn('w-4 h-4', project.isPinned && 'text-accent-amber')} />}
                />
                <Button variant="ghost" size="sm" onClick={onEdit} icon={<Edit className="w-4 h-4" />} />
                <Button variant="ghost" size="sm" onClick={onToggleArchive} icon={<Archive className="w-4 h-4" />} />
                <Button variant="ghost" size="sm" onClick={onDelete} icon={<Trash2 className="w-4 h-4 text-red-500" />} />
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />} />
          </div>
        </div>
      </div>

      {/* Workspace Content with Provider */}
      <div className="p-6 h-[calc(100vh-73px)] overflow-auto">
        <WorkspaceProvider projectId={project.id}>
          <WorkspaceTabsContent projectId={project.id} />
        </WorkspaceProvider>
      </div>
    </motion.div>
  );
}
