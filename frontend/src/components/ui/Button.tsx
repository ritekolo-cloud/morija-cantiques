import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-cream focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-yellow text-black hover:bg-yellow/90 shadow-lg shadow-yellow/20 active:scale-95',
        destructive:
          'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 active:scale-95',
        outline:
          'border-2 border-black dark:border-cream text-black dark:text-cream hover:bg-black/5 dark:hover:bg-cream/5 active:scale-95',
        secondary:
          'bg-black/5 dark:bg-cream/10 text-black dark:text-cream hover:bg-black/10 dark:hover:bg-cream/20 active:scale-95',
        ghost:
          'hover:bg-black/5 dark:hover:bg-cream/10 text-black dark:text-cream active:scale-95',
        link: 'text-black dark:text-cream underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 px-6 py-2',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-14 px-8 text-base',
        icon: 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // using a simple tag instead of Slot if radix isn't strictly required to be installed 
    // to avoid compilation issues, since I only put radix in instructions implicitly
    const Comp = asChild ? Slot : "button"
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
