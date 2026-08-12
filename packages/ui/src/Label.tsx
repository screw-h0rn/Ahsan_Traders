import * as React from 'react';
import { cn } from './cn';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn('text-sm font-semibold text-[#4c5b55]', className)}
        {...props}
      />
    );
  },
);
Label.displayName = 'Label';
