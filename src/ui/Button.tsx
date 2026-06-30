import { cn } from '@/utils';
import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
  icon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, children, className, ...props }, ref) => {
    const variants = {
      primary: 'bg-omni-900 text-white hover:bg-omni-800 active:bg-omni-950',
      secondary: 'bg-omni-100 text-omni-700 hover:bg-omni-200 active:bg-omni-300',
      ghost: 'bg-transparent text-omni-600 hover:bg-omni-100 active:bg-omni-200',
      danger: 'bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200',
      outline: 'bg-transparent border border-omni-300 text-omni-700 hover:bg-omni-50 active:bg-omni-100',
    };

    const sizes = {
      sm: 'px-2.5 py-1.5 text-xs gap-1',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-sm gap-2',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-omni-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };
