import React from 'react';
import { cn } from '../../utils/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, error, ...props }, ref) => {
    return (
      <div className="relative w-full group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40 dark:text-cream/40 transition-colors group-focus-within:text-black dark:group-focus-within:text-cream">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-14 w-full rounded-2xl border-2 border-black/10 dark:border-white/10 bg-white dark:bg-black/50 px-4 py-2 text-sm font-medium transition-all duration-300',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'placeholder:text-black/40 dark:placeholder:text-cream/40',
            'focus:outline-none focus:border-yellow focus:ring-4 focus:ring-yellow/10 dark:focus:ring-yellow/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            icon && 'pl-12',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/10',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="absolute -bottom-6 left-2 text-xs font-semibold text-red-500">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
