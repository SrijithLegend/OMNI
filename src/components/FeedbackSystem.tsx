import { useState } from 'react';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Textarea } from '@/ui/Textarea';
import {
  Bug,
  Lightbulb,
  MessageSquare,
  Star,
  Send,
  Paperclip,
  Upload,
  X,
  Check,
  ExternalLink,
  Mail,
  ChevronDown,
} from 'lucide-react';

interface FeedbackSystemProps {
  isOpen: boolean;
  onClose: () => void;
}

export type FeedbackType = 'bug' | 'feature' | 'general' | 'rating';

export function FeedbackSystem({ isOpen, onClose }: FeedbackSystemProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [submitted, setSubmitted] = useState(false);

  const handleReset = () => {
    setFeedbackType('general');
    setSubmitted(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="" size="md">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-100 mb-2">
            Thanks for your feedback!
          </h2>
          <p className="text-slate-400 mb-6">
            We appreciate you taking the time to help us improve Omni.
          </p>
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Send Feedback" size="lg">
      <div className="space-y-6">
        {/* Feedback Type Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            What would you like to share?
          </label>
          <div className="grid grid-cols-4 gap-3">
            <FeedbackTypeButton
              type="bug"
              icon={<Bug className="w-5 h-5" />}
              label="Bug Report"
              selected={feedbackType === 'bug'}
              onClick={() => setFeedbackType('bug')}
            />
            <FeedbackTypeButton
              type="feature"
              icon={<Lightbulb className="w-5 h-5" />}
              label="Feature Request"
              selected={feedbackType === 'feature'}
              onClick={() => setFeedbackType('feature')}
            />
            <FeedbackTypeButton
              type="general"
              icon={<MessageSquare className="w-5 h-5" />}
              label="General"
              selected={feedbackType === 'general'}
              onClick={() => setFeedbackType('general')}
            />
            <FeedbackTypeButton
              type="rating"
              icon={<Star className="w-5 h-5" />}
              label="Rate Omni"
              selected={feedbackType === 'rating'}
              onClick={() => setFeedbackType('rating')}
            />
          </div>
        </div>

        {/* Dynamic Content Based on Type */}
        {feedbackType === 'bug' && <BugReportForm onSuccess={() => setSubmitted(true)} />}
        {feedbackType === 'feature' && <FeatureRequestForm onSuccess={() => setSubmitted(true)} />}
        {feedbackType === 'general' && <GeneralFeedbackForm onSuccess={() => setSubmitted(true)} />}
        {feedbackType === 'rating' && <RatingForm onSuccess={() => setSubmitted(true)} />}
      </div>
    </Modal>
  );
}

function FeedbackTypeButton({
  type: _type,
  icon,
  label,
  selected,
  onClick,
}: {
  type: FeedbackType;
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border text-center transition-all ${
        selected
          ? 'bg-blue-500/20 border-blue-500 text-blue-400'
          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
      }`}
    >
      <div className="flex justify-center mb-2">{icon}</div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function BugReportForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [includeLogs, setIncludeLogs] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSubmitting(false);
    onSuccess();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Bug Title
        </label>
        <Input
          placeholder="Brief description of the bug"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Description
        </label>
        <Textarea
          placeholder="What's happening?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Steps to Reproduce
        </label>
        <Textarea
          placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Expected Behavior
          </label>
          <Textarea
            placeholder="What should happen?"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Actual Behavior
          </label>
          <Textarea
            placeholder="What actually happens?"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Attachments (optional)
        </label>
        <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center">
          <input
            type="file"
            id="bug-attachments"
            multiple
            accept="image/*,.log,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
          <label
            htmlFor="bug-attachments"
            className="cursor-pointer text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Upload className="w-6 h-6 mx-auto mb-2" />
            <span className="text-sm">Click to upload screenshots or logs</span>
          </label>
        </div>
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg text-sm"
              >
                <Paperclip className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="include-logs"
          checked={includeLogs}
          onChange={(e) => setIncludeLogs(e.target.checked)}
          className="w-4 h-4 rounded border-slate-600"
        />
        <label htmlFor="include-logs" className="text-sm text-slate-300">
          Include diagnostic logs (helps us debug faster)
        </label>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" variant="primary" disabled={submitting || !title || !description}>
          <Send className="w-4 h-4 mr-2" />
          {submitting ? 'Submitting...' : 'Submit Bug Report'}
        </Button>
      </div>
    </form>
  );
}

function FeatureRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [useCase, setUseCase] = useState('');
  const [priority, setPriority] = useState<'nice-to-have' | 'important' | 'critical'>('nice-to-have');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitting(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Feature Title
        </label>
        <Input
          placeholder="What feature would you like?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Description
        </label>
        <Textarea
          placeholder="Describe the feature in detail"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Your Use Case
        </label>
        <Textarea
          placeholder="How would this help you?"
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Priority
        </label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
        >
          <option value="nice-to-have">Nice to have</option>
          <option value="important">Important</option>
          <option value="critical">Critical for my workflow</option>
        </select>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" variant="primary" disabled={submitting || !title || !description}>
          <Lightbulb className="w-4 h-4 mr-2" />
          {submitting ? 'Submitting...' : 'Submit Feature Request'}
        </Button>
      </div>
    </form>
  );
}

function GeneralFeedbackForm({ onSuccess }: { onSuccess: () => void }) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitting(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Your Message
        </label>
        <Textarea
          placeholder="Share your thoughts, questions, or anything else..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Email (optional)
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            disabled={anonymous}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="anonymous"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="w-4 h-4 rounded border-slate-600"
        />
        <label htmlFor="anonymous" className="text-sm text-slate-300">
          Submit anonymously
        </label>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" variant="primary" disabled={submitting || !message}>
          <Send className="w-4 h-4 mr-2" />
          {submitting ? 'Sending...' : 'Send Feedback'}
        </Button>
      </div>
    </form>
  );
}

function RatingForm({ onSuccess }: { onSuccess: () => void }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitting(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-slate-100 mb-4">
          How would you rate Omni?
        </h3>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`p-2 rounded-lg transition-colors ${
                star <= rating
                  ? 'text-yellow-400 bg-yellow-400/10'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <Star className={`w-8 h-8 ${star <= rating ? 'fill-yellow-400' : ''}`} />
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {rating === 0 && 'Select a rating'}
          {rating === 1 && 'Poor - Needs major improvements'}
          {rating === 2 && 'Fair - Has issues'}
          {rating === 3 && 'Good - Works well'}
          {rating === 4 && 'Very Good - Great experience'}
          {rating === 5 && 'Excellent - Love it!'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Additional Feedback (optional)
        </label>
        <Textarea
          placeholder="What could we do better?"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
        />
      </div>

      {rating >= 4 && (
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-center">
          <p className="text-sm text-slate-300 mb-2">
            Enjoying Omni? Consider leaving a review on the Chrome Web Store!
          </p>
          <button
            type="button"
            className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
          >
            <ExternalLink className="w-4 h-4" />
            Leave a Review
          </button>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button type="submit" variant="primary" disabled={submitting || rating === 0}>
          <Star className="w-4 h-4 mr-2" />
          {submitting ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </div>
    </form>
  );
}

// Support Contact Component
interface SupportContactProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportContact({ isOpen, onClose }: SupportContactProps) {
  const channels = [
    {
      icon: <Mail className="w-6 h-6" />,
      name: 'Email',
      description: 'support@omni-ai.app',
      action: 'mailto:support@omni-ai.app',
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      name: 'Discord',
      description: 'Join our community',
      action: 'https://discord.gg/omni',
    },
    {
      icon: <ExternalLink className="w-6 h-6" />,
      name: 'Documentation',
      description: 'Browse guides and API docs',
      action: 'https://docs.omni-ai.app',
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Contact Support" size="md">
      <div className="space-y-6">
        <p className="text-slate-400">
          Need help? We're here for you. Choose how you'd like to reach out.
        </p>

        <div className="space-y-3">
          {channels.map((channel) => (
            <a
              key={channel.name}
              href={channel.action}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
            >
              <div className="p-2 rounded-lg bg-slate-700 text-slate-400">
                {channel.icon}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-200">{channel.name}</h4>
                <p className="text-sm text-slate-400">{channel.description}</p>
              </div>
              <ChevronDown className="w-5 h-5 text-slate-500 -rotate-90" />
            </a>
          ))}
        </div>
      </div>
    </Modal>
  );
}
