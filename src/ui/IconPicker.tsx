import { cn } from '@/utils';
import { PROJECT_ICONS } from '@/types';
import * as Icons from 'lucide-react';
import { useState } from 'react';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? PROJECT_ICONS.filter((i) => i.toLowerCase().includes(search.toLowerCase()))
    : PROJECT_ICONS;

  return (
    <div className="w-full">
      <label className="mb-1 block text-sm font-medium text-omni-700">Icon</label>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search icons..."
        className={cn(
          'w-full rounded-lg border border-omni-300 bg-white px-3 py-2 text-sm text-omni-900 placeholder:text-omni-400',
          'focus:border-omni-500 focus:outline-none focus:ring-2 focus:ring-omni-400/20 mb-2'
        )}
      />
      <div className="grid grid-cols-5 gap-1 max-h-36 overflow-y-auto p-1 rounded-lg border border-omni-200 bg-omni-50">
        {filtered.map((iconName) => {
          const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
          if (!Icon) return null;
          return (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              className={cn(
                'flex items-center justify-center rounded-md p-2 transition-colors',
                value === iconName
                  ? 'bg-omni-900 text-white'
                  : 'bg-transparent text-omni-600 hover:bg-omni-200'
              )}
              title={iconName}
              aria-label={`Select ${iconName} icon`}
              aria-pressed={value === iconName}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
