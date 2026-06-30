import { useState, useEffect } from 'react';
import { Modal } from '@/ui/Modal';
import { Input } from '@/ui/Input';
import { Textarea } from '@/ui/Textarea';
import { Button } from '@/ui/Button';
import { IconPicker } from '@/ui/IconPicker';
import { ColorPicker } from '@/ui/ColorPicker';
import { ProjectId } from '@/types';
import { useProjectStore } from '@/state';
import { Save } from 'lucide-react';

interface EditProjectModalProps {
  isOpen: boolean;
  projectId: ProjectId | null;
  onClose: () => void;
}

export function EditProjectModal({ isOpen, projectId, onClose }: EditProjectModalProps) {
  const projects = useProjectStore((s) => s.projects);
  const updateProject = useProjectStore((s) => s.updateProject);

  const project = projectId ? projects.find((p) => p.id === projectId) : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('FileText');
  const [color, setColor] = useState('#3b82f6');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description);
      setIcon(project.icon);
      setColor(project.color);
      setIsFavorite(project.isFavorite);
      setIsArchived(project.isArchived);
      setIsPinned(project.isPinned);
      setNameError('');
      setIsSubmitting(false);
    }
  }, [project]);

  const handleClose = () => {
    setNameError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setNameError('');
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Project name is required');
      return;
    }
    if (trimmed.length > 100) {
      setNameError('Name must be under 100 characters');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateProject(projectId, {
        name: trimmed,
        description: description.trim(),
        icon,
        color,
        isFavorite,
        isArchived,
        isPinned,
      });
      handleClose();
    } catch (err) {
      if (err instanceof Error) {
        setNameError(err.message);
      }
      setIsSubmitting(false);
    }
  };

  if (!project) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Project"
      description={`Update "${project.name}"`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            icon={<Save className="w-4 h-4" />}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Input
              label="Project Name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              error={nameError}
              maxLength={100}
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-4">
            <IconPicker value={icon} onChange={setIcon} />
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <label className="flex items-center gap-2 text-sm text-omni-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="rounded border-omni-300 text-omni-900 focus:ring-omni-400"
            />
            Favorite
          </label>
          <label className="flex items-center gap-2 text-sm text-omni-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-omni-300 text-omni-900 focus:ring-omni-400"
            />
            Pinned
          </label>
          <label className="flex items-center gap-2 text-sm text-omni-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isArchived}
              onChange={(e) => setIsArchived(e.target.checked)}
              className="rounded border-omni-300 text-omni-900 focus:ring-omni-400"
            />
            Archived
          </label>
        </div>
      </form>
    </Modal>
  );
}
