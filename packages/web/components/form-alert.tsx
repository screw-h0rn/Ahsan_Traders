import { cn } from '@at/ui';

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border px-3.5 py-2.5 text-sm backdrop-blur-xl',
        error
          ? 'border-[#c25f4a]/25 bg-[#c25f4a]/10 text-[#9f4938]'
          : 'border-[#1a6b5a]/25 bg-[#1a6b5a]/10 text-[#145344]',
      )}
    >
      {error ?? message}
    </div>
  );
}
