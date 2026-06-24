import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center", className)}>
      <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-black/40 dark:text-cream/40" />
      </div>
      <h3 className="font-playfair text-xl font-bold mb-2 text-black dark:text-cream">{title}</h3>
      <p className="text-black/60 dark:text-cream/60 text-sm max-w-[250px]">
        {description}
      </p>
    </div>
  );
}
