'use client';

import { Button } from '@at/ui';

export function PrintInvoiceButton() {
  return (
    <Button className="print:hidden" variant="outline" onClick={() => window.print()}>
      Print / save PDF
    </Button>
  );
}