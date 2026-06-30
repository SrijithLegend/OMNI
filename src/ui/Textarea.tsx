import { cn } from '@/utils';
import { type TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, rows = 3, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1 block text-sm font-medium text-omni-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={cn(
            'w-full rounded-lg border border-omni-300 bg-white px-3 py-2 text-sm text-omni-900 placeholder:text-omni-400',
            'transition-colors duration-150 resize-none',
            'focus:border-omni-500 focus:outline-none focus:ring-2 focus:ring-omni-400/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-400/20',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
export { Textarea };
