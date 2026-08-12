import type { NextConfig } from 'next';

const securityHeaders = [
  // Force HTTPS for a year once seen over HTTPS (no-op on localhost).
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // The app never needs to be framed — blocks clickjacking.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // Never sniff content types.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak URLs (which can contain record ids) to other origins.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The app uses none of these browser capabilities.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source and are compiled by Next.
  transpilePackages: ['@at/ui', '@at/shared'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
