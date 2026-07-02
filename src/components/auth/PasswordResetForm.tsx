import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { useAuth } from '@/engines';
import { Mail, ArrowLeft, CircleCheck as CheckCircle, Send } from 'lucide-react';

interface PasswordResetFormProps {
  onLogin: () => void;
}

export function PasswordResetForm({ onLogin }: PasswordResetFormProps) {
  const { resetPassword, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }

    try {
      await resetPassword({ email });
      setSent(true);
    } catch {
      // Error handled by useAuth
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-100">Email sent</h2>
        <p className="text-sm text-slate-400">
          Check your inbox at <span className="text-slate-200">{email}</span> for password reset instructions.
        </p>
        <Button variant="ghost" onClick={onLogin} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-slate-100">Reset password</h2>
        <p className="mt-2 text-sm text-slate-400">We'll send you a link to reset your password</p>
      </div>

      {(error || localError) && (
        <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full justify-center gap-2"
          disabled={isLoading}
          icon={<Send className="w-4 h-4" />}
        >
          {isLoading ? 'Sending...' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-center">
        <button
          onClick={onLogin}
          className="text-sm text-slate-400 hover:text-slate-300 transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to sign in
        </button>
      </p>
    </div>
  );
}
