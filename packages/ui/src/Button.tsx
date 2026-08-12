import * as React from 'react';
import { cn } from './cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#143e34]/95 text-[#f2faf6] shadow-[0_14px_30px_-12px_rgba(20,60,48,0.5)] hover:-translate-y-0.5 hover:bg-[#102f29] focus-visible:ring-brand-500',
  secondary: 'bg-white/60 text-[#2c3a34] hover:bg-white/85 focus-visible:ring-brand-300',
  outline:
    'border border-white/85 bg-white/50 text-[#2c3a34] backdrop-blur-xl hover:bg-white/85 focus-visible:ring-brand-300',
  ghost: 'text-[#4c5b55] hover:bg-white/60 focus-visible:ring-brand-300',
  danger:
    'bg-[#c25f4a] text-white hover:-translate-y-0.5 hover:bg-[#a94f3e] focus-visible:ring-[#c25f4a]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 active:scale-[0.97]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
