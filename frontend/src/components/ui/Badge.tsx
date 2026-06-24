import React from 'react';
import { cn } from '../../utils/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Badge({ className, children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center bg-black dark:bg-[#22221e] text-yellow px-3 py-1 rounded-full text-xs font-bold tracking-wider shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
