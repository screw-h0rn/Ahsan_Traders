'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@at/ui';

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  // Provide a conservative inline fallback style so the button remains visible
  // even if Tailwind output or arbitrary color utilities are not present.
  const passedStyle = (props as any).style ?? {};
  const fallbackStyle: React.CSSProperties = {
    backgroundColor: '#143e34',
    color: '#f2faf6',
    borderRadius: 9999,
    paddingLeft: 16,
    paddingRight: 16,
  };
  const mergedStyle = { ...fallbackStyle, ...passedStyle };

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props} style={mergedStyle}>
      {pending ? 'Please wait…' : children}
    </Button>
  );
}
