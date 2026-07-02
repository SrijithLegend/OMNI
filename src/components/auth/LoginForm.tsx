import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { useAuth } from '@/engines';
import { Mail, Lock, LogIn, Chrome, Github, ArrowRight, Wand as Wand2 } from 'lucide-react';

interface LoginFormProps {
  onSignUp: () => void;
  onForgotPassword: () => void;
  onClose?: () => void;
}

export function LoginForm({ onSignUp, onForgotPassword, onClose }: LoginFormProps) {
  const { signIn, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }
    if (!password) {
      setLocalError('Password is required');
      return;
    }

    try {
      await signIn({ provider: 'email', email, password });
      onClose?.();
    } catch {
      // Error is handled by useAuth
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn({ provider: 'google' });
    } catch {
      // Redirects to Google
    }
  };

  const handleGitHubSignIn = async () => {
    try {
      await signIn({ provider: 'github' });
    } catch {
      // Redirects to GitHub
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setLocalError('Enter your email for magic link');
      return;
    }

    try {
      await signIn({ provider: 'magic_link', email });
    } catch {
      // Error handled by useAuth
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-slate-100">Welcome back</h2>
        <p className="mt-2 text-sm text-slate-400">Sign in to sync your data across devices</p>
      </div>

      {(error || localError) && (
        <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
          {localError || error}
        </div>
      )}

      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <Chrome className="w-5 h-5" />
          Continue with Google
        </Button>

        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={handleGitHubSignIn}
          disabled={isLoading}
        >
          <Github className="w-5 h-5" />
          Continue with GitHub
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-slate-900 text-slate-500">or email</span>
        </div>
      </div>

      <form onSubmit={handleEmailSignIn} className="space-y-4">
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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={handleMagicLink}
            className="text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
            disabled={isLoading || !email.trim()}
          >
            <Wand2 className="inline w-4 h-4 mr-1" />
            Send magic link
          </button>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full justify-center gap-2"
          disabled={isLoading}
          icon={<LogIn className="w-4 h-4" />}
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-400">
        Don't have an account?{' '}
        <button
          onClick={onSignUp}
          className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
        >
          Create one
          <ArrowRight className="w-3 h-3" />
        </button>
      </p>
    </div>
  );
}
