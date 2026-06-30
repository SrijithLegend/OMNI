import { useState } from 'react';
import { Modal } from '@/ui/Modal';
import { Input } from '@/ui/Input';
import { Textarea } from '@/ui/Textarea';
import { Button } from '@/ui/Button';
import { IconPicker } from '@/ui/IconPicker';
import { ColorPicker } from '@/ui/ColorPicker';
import { ProjectTemplate, PROJECT_ICONS, PROJECT_COLORS } from '@/types';
import { ProjectEngine } from '@/engines';
import { useProjectStore } from '@/state';
import { Sparkles } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(PROJECT_ICONS[0]);
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createProject = useProjectStore((s) => s.createProject);
  const templates = ProjectEngine.getTemplates();

  const reset = () => {
    setName('');
    setDescription('');
    setIcon(PROJECT_ICONS[0]);
    setColor(PROJECT_COLORS[0]);
    setTemplate(null);
    setNameError('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await createProject({
        name: trimmed,
        description: description.trim(),
        icon,
        color,
        template: template ?? undefined,
      });
      handleClose();
    } catch (err) {
      if (err instanceof Error) {
        setNameError(err.message);
      }
      setIsSubmitting(false);
    }
  };

  const handleTemplateSelect = (t: ProjectTemplate) => {
    setTemplate(t);
    const cfg = ProjectEngine.getTemplate(t);
    if (cfg) {
      setIcon(cfg.icon);
      setColor(cfg.color);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Project"
      description="Start a new project in Omni"
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
            icon={<Sparkles className="w-4 h-4" />}
          >
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Input
              label="Project Name"
              placeholder="e.g., AI Chatbot"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              error={nameError}
              autoFocus
              maxLength={100}
            />
            <Textarea
              label="Description"
              placeholder="What is this project about?"
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

        <div>
          <label className="mb-2 block text-sm font-medium text-omni-700">Template</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTemplateSelect(t.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  template === t.id
                    ? 'border-omni-900 bg-omni-900 text-white'
                    : 'border-omni-200 bg-white text-omni-700 hover:bg-omni-50'
                }`}
                aria-pressed={template === t.id}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className={`text-xs truncate ${template === t.id ? 'text-omni-300' : 'text-omni-400'}`}>
                    {t.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
