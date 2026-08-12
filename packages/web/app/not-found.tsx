import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@at/ui';

export default function NotFound() {
  return (
    <div className="anim-scale-in mx-auto mt-24 max-w-lg px-6">
      <Card>
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            That page doesn&apos;t exist or may have been archived. Check the address, or
            head back to safety.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost">Home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
