import React from 'react';
import { cn } from '../../utils/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-center items-center p-4", className)}>
      <div className="w-8 h-8 rounded-full border-4 border-black/10 dark:border-cream/10 border-t-yellow animate-spin" />
    </div>
  );
}
