'use client';

import { Button } from '@at/ui';
import { signOutAction } from '@/app/(auth)/actions';

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline" size="sm" className={className}>
        Sign out
      </Button>
    </form>
  );
}
