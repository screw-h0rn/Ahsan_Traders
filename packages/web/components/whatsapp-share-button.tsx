'use client';

import { Button } from '@at/ui';
import { buildWaMeUrl } from '@/lib/whatsapp';

/**
 * Tier-1 WhatsApp sharing: opens the owner's own WhatsApp (app or Web) with a
 * pre-formatted message addressed to the customer. Zero setup required.
 */
export function WhatsAppShareButton({
  phone,
  message,
  label = 'Send on WhatsApp',
  className,
}: {
  phone: string | null | undefined;
  message: string;
  label?: string;
  className?: string;
}) {
  if (!phone) return null;
  const url = buildWaMeUrl(phone, message);
  if (!url) return null;
  return (
    <Button
      variant="outline"
      className={className}
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
    >
      {label}
    </Button>
  );
}
