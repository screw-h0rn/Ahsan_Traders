'use client';

import { useEffect } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@at/ui';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="anim-scale-in mx-auto mt-16 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            The page hit an unexpected error. Your data is safe — try again, and if it
            keeps happening the Supabase project may be paused (free tier pauses after
            ~1 week idle).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="ghost" onClick={() => (window.location.href = '/dashboard')}>
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
