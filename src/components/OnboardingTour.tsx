import { useState, useCallback } from 'react';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/Button';
import {
  FolderOpen,
  MessageSquare,
  Link2,
  Github,
  Cloud,
  FileText,
  Upload,
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  X,
} from 'lucide-react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    handler: () => void | Promise<void>;
  };
  completed: boolean;
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingTour({ isOpen, onClose, onComplete }: OnboardingTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'create-project',
      title: 'Create Your First Project',
      description: 'Projects organize your AI conversations, notes, and files. Create one to get started.',
      icon: <FolderOpen className="w-8 h-8" />,
      completed: false,
    },
    {
      id: 'capture-conversation',
      title: 'Capture a Conversation',
      description: 'Visit ChatGPT, Claude, Gemini, or Grok and have a conversation. Omni will automatically capture it.',
      icon: <MessageSquare className="w-8 h-8" />,
      completed: false,
    },
    {
      id: 'switch-ai',
      title: 'Switch Between AI Models',
      description: 'Transfer your conversation context between different AI models with one click.',
      icon: <Link2 className="w-8 h-8" />,
      completed: false,
    },
    {
      id: 'connect-github',
      title: 'Connect Your GitHub',
      description: 'Link your GitHub account to sync repositories and issues with your workspace.',
      icon: <Github className="w-8 h-8" />,
      completed: false,
    },
    {
      id: 'connect-drive',
      title: 'Connect Google Drive',
      description: 'Link Google Drive to access and organize your files alongside conversations.',
      icon: <Cloud className="w-8 h-8" />,
      completed: false,
    },
    {
      id: 'create-note',
      title: 'Create a Note',
      description: 'Notes help you capture ideas, meeting notes, or anything else alongside your AI work.',
      icon: <FileText className="w-8 h-8" />,
      completed: false,
    },
    {
      id: 'upload-file',
      title: 'Upload a File',
      description: 'Add files to your project to keep everything in one place.',
      icon: <Upload className="w-8 h-8" />,
      completed: false,
    },
    {
      id: 'cloud-sync',
      title: 'Enable Cloud Sync',
      description: 'Sync your workspace across all your devices. Upgrade to Pro for cloud features.',
      icon: <Sparkles className="w-8 h-8" />,
      completed: false,
    },
  ]);

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.completed).length;
  const progress = (completedSteps / totalSteps) * 100;

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }, [currentStepIndex, steps.length]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const handleSkip = useCallback(() => {
    handleNext();
  }, [handleNext]);

  const handleCompleteStep = useCallback((stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, completed: true } : step
      )
    );
  }, []);

  const handleFinish = useCallback(() => {
    onComplete();
    onClose();
  }, [onComplete, onClose]);

  const handleSkipAll = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleAction = currentStep.action ? currentStep.action.handler : null;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="relative">
        {/* Close button */}
        <button
          onClick={handleSkipAll}
          className="absolute top-0 right-0 p-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
            <span>Getting started</span>
            <span>{completedSteps} of {totalSteps} completed</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStepIndex(index)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                index === currentStepIndex
                  ? 'bg-blue-500 text-white'
                  : step.completed
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-700 text-slate-500'
              }`}
            >
              {step.completed ? (
                <Check className="w-4 h-4" />
              ) : (
                <span className="text-xs">{index + 1}</span>
              )}
            </button>
          ))}
        </div>

        {/* Current step content */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            {currentStep.icon}
          </div>

          <h3 className="text-2xl font-semibold text-slate-100 mb-3">
            {currentStep.title}
          </h3>
          <p className="text-slate-400 max-w-md mx-auto">
            {currentStep.description}
          </p>

          {currentStep.action && (
            <button
              onClick={() => {
                handleAction?.();
                handleCompleteStep(currentStep.id);
              }}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {currentStep.action.label}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-700">
          <button
            onClick={handlePrevious}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSkip}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Skip
              <SkipForward className="w-4 h-4" />
            </button>

            {currentStepIndex === steps.length - 1 ? (
              <Button variant="primary" onClick={handleFinish}>
                Finish Setup
              </Button>
            ) : (
              <Button variant="primary" onClick={handleNext}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Coach Mark Component for feature highlights
interface CoachMarkProps {
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  onDismiss: () => void;
  onNext?: () => void;
}

export function CoachMark({
  title,
  description,
  position,
  onDismiss,
  onNext,
}: CoachMarkProps) {
  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  return (
    <div className={`absolute ${positionClasses[position]} z-50`}>
      <div className="relative bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 max-w-xs">
        <div className="absolute -inset-1 bg-blue-500/20 rounded-lg blur-sm -z-10" />

        <h4 className="font-semibold text-slate-100 mb-2">{title}</h4>
        <p className="text-sm text-slate-400 mb-4">{description}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={onDismiss}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Dismiss
          </button>
          {onNext && (
            <button
              onClick={onNext}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Next tip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// What's New Modal
interface WhatsNewProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

export function WhatsNew({ isOpen, onClose, version }: WhatsNewProps) {
  const features = [
    {
      type: 'new',
      title: 'AI Model Switching',
      description: 'Transfer context between ChatGPT, Claude, Gemini, and Grok.',
    },
    {
      type: 'new',
      title: 'Cloud Sync',
      description: 'Sync your workspace across all devices with encrypted cloud storage.',
    },
    {
      type: 'new',
      title: 'Universal Search',
      description: 'Search across all conversations, notes, and files instantly.',
    },
    {
      type: 'improved',
      title: 'Faster Capture',
      description: 'Conversations are now captured 3x faster with improved reliability.',
    },
    {
      type: 'fixed',
      title: 'Bug Fixes',
      description: 'Fixed issues with notes saving and project archiving.',
    },
  ];

  const typeColors = {
    new: 'bg-green-500/20 text-green-400',
    improved: 'bg-blue-500/20 text-blue-400',
    fixed: 'bg-amber-500/20 text-amber-400',
  };

  const typeLabels = {
    new: 'New',
    improved: 'Improved',
    fixed: 'Fixed',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="What's New" size="md">
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-100">
            Welcome to Omni {version}
          </h2>
        </div>

        <div className="space-y-3">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${typeColors[feature.type as keyof typeof typeColors]}`}>
                  {typeLabels[feature.type as keyof typeof typeLabels]}
                </span>
                <div>
                  <h4 className="font-medium text-slate-200">{feature.title}</h4>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="primary" className="w-full" onClick={onClose}>
          Let's Go
        </Button>
      </div>
    </Modal>
  );
}

// Keyboard Shortcuts Help
interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  const shortcuts = [
    { category: 'Navigation', keys: [
      { key: 'Ctrl/Cmd + K', action: 'Open command palette' },
      { key: 'Ctrl/Cmd + P', action: 'Quick search' },
      { key: 'Ctrl/Cmd + B', action: 'Toggle sidebar' },
    ]},
    { category: 'Projects', keys: [
      { key: 'Ctrl/Cmd + N', action: 'New project' },
      { key: 'Ctrl/Cmd + Shift + N', action: 'New note' },
    ]},
    { category: 'Capture', keys: [
      { key: 'Ctrl/Cmd + S', action: 'Save current conversation' },
      { key: 'Ctrl/Cmd + Shift + S', action: 'Export conversation' },
    ]},
    { category: 'AI Switching', keys: [
      { key: 'Ctrl/Cmd + Shift + C', action: 'Switch to Claude' },
      { key: 'Ctrl/Cmd + Shift + G', action: 'Switch to ChatGPT' },
      { key: 'Ctrl/Cmd + Shift + M', action: 'Switch to Gemini' },
    ]},
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="lg">
      <div className="space-y-6">
        {shortcuts.map((group) => (
          <div key={group.category}>
            <h3 className="text-sm font-medium text-slate-400 mb-3">{group.category}</h3>
            <div className="space-y-2">
              {group.keys.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg"
                >
                  <span className="text-slate-300">{shortcut.action}</span>
                  <kbd className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-slate-400 font-mono">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
