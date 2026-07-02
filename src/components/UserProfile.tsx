import { useState, useEffect } from 'react';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { useAuth, AuthUser } from '@/engines';
import { User, Mail, Shield, LogOut, Save, Camera, Monitor, Smartphone, Tablet, Trash2, TriangleAlert as AlertTriangle } from 'lucide-react';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'profile' | 'security' | 'devices';

export function UserProfile({ isOpen, onClose }: UserProfileProps) {
  const { user, signOut, updateProfile, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      await updateProfile({ displayName, avatarUrl: avatarUrl || undefined });
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  if (!isAuthenticated) {
    return null;
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'devices', label: 'Devices', icon: <Monitor className="w-4 h-4" /> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account Settings" size="lg">
      <div className="flex gap-6 min-h-[400px]">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 border-r border-slate-700 pr-4">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {message && (
            <div
              className={`mb-4 p-3 text-sm rounded-lg ${
                message.type === 'success'
                  ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                  : 'text-red-400 bg-red-500/10 border border-red-500/20'
              }`}
            >
              {message.text}
            </div>
          )}

          {activeTab === 'profile' && (
            <ProfileTab
              user={user}
              displayName={displayName}
              setDisplayName={setDisplayName}
              avatarUrl={avatarUrl}
              setAvatarUrl={setAvatarUrl}
              saving={saving}
              onSave={handleSaveProfile}
            />
          )}

          {activeTab === 'security' && <SecurityTab />}

          {activeTab === 'devices' && <DevicesTab />}
        </div>
      </div>
    </Modal>
  );
}

function ProfileTab({
  user,
  displayName,
  setDisplayName,
  avatarUrl,
  setAvatarUrl,
  saving,
  onSave,
}: {
  user: AuthUser | null;
  displayName: string;
  setDisplayName: (v: string) => void;
  avatarUrl: string;
  setAvatarUrl: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-slate-700 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-8 h-8 text-slate-500" />
              </div>
            )}
          </div>
          <button className="absolute bottom-0 right-0 p-1.5 bg-blue-500 rounded-full text-white hover:bg-blue-600 transition-colors">
            <Camera className="w-3 h-3" />
          </button>
        </div>
        <div>
          <h3 className="font-medium text-slate-100">{user.displayName || 'User'}</h3>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Display name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Avatar URL</label>
          <Input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Contact support to change your email</p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-700">
        <Button variant="primary" onClick={onSave} disabled={saving || !displayName.trim()}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-100 mb-4">Security settings</h3>
      </div>

      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-slate-100">Two-factor authentication</h4>
            <p className="text-sm text-slate-400 mt-1">Add an extra layer of security to your account</p>
          </div>
          <Button variant="outline" size="sm">
            Enable
          </Button>
        </div>
      </div>

      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-slate-100">Password</h4>
            <p className="text-sm text-slate-400 mt-1">Last changed 30 days ago</p>
          </div>
          <Button variant="outline" size="sm">
            Change
          </Button>
        </div>
      </div>

      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-slate-100">Active sessions</h4>
            <p className="text-sm text-slate-400 mt-1">Manage where you're logged in</p>
          </div>
          <Button variant="outline" size="sm">
            View all
          </Button>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-700">
        <button className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
          <AlertTriangle className="w-4 h-4" />
          Delete account
        </button>
      </div>
    </div>
  );
}

function DevicesTab() {
  const devices = [
    { id: 1, name: 'MacBook Pro', type: 'desktop', lastActive: 'Now', current: true },
    { id: 2, name: 'iPhone 15', type: 'phone', lastActive: '2 hours ago', current: false },
    { id: 3, name: 'iPad Pro', type: 'tablet', lastActive: 'Yesterday', current: false },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'phone':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-100 mb-4">Your devices</h3>
      </div>

      <div className="space-y-3">
        {devices.map((device) => (
          <div
            key={device.id}
            className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-700 rounded-lg text-slate-400">{getIcon(device.type)}</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">{device.name}</span>
                  {device.current && (
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                      This device
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">Last active: {device.lastActive}</p>
              </div>
            </div>

            {!device.current && (
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        Devices are automatically removed after 30 days of inactivity.
      </p>
    </div>
  );
}
