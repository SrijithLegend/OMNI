import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { useAuth } from '@/engines';
import { Mail, Lock, User, UserPlus, Chrome, Github, ArrowLeft, Wand as Wand2 } from 'lucide-react';

interface RegisterFormProps {
  onLogin: () => void;
  onClose?: () => void;
}

export function RegisterForm({ onLogin, onClose: _onClose }: RegisterFormProps) {
  const { signUp, signIn, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
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
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await signUp({
        email,
        password,
        displayName: displayName.trim() || undefined,
      });
      setSuccess(true);
    } catch {
      // Error handled by useAuth
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
      setSuccess(true);
    } catch {
      // Error handled by useAuth
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
          <Mail className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-100">Check your email</h2>
        <p className="text-sm text-slate-400">
          We sent a confirmation link to <span className="text-slate-200">{email}</span>
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
        <h2 className="text-2xl font-semibold text-slate-100">Create account</h2>
        <p className="mt-2 text-sm text-slate-400">Join Omni to sync across all your devices</p>
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
          <span className="px-2 bg-slate-900 text-slate-500">or register with email</span>
        </div>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-1.5">
            Display name <span className="text-slate-500">(optional)</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>

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
              placeholder="Min 8 characters"
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">
            Confirm password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
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
            Use magic link instead
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full justify-center gap-2"
          disabled={isLoading}
          icon={<UserPlus className="w-4 h-4" />}
        >
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <button onClick={onLogin} className="text-blue-400 hover:text-blue-300 transition-colors">
          Sign in
        </button>
      </p>
    </div>
  );
}
