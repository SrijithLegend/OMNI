import { cn } from '@/utils';
import { PROJECT_COLORS } from '@/types';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="w-full">
      <label className="mb-1 block text-sm font-medium text-omni-700">Color</label>
      <div className="flex flex-wrap gap-2">
        {PROJECT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'w-8 h-8 rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-omni-400',
              value === color ? 'scale-110 ring-2 ring-offset-1 ring-omni-900' : 'hover:scale-105'
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            aria-pressed={value === color}
          />
        ))}
      </div>
    </div>
  );
}
