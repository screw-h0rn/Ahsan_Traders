'use client';

import { useRouter } from 'next/navigation';
import { Select } from '@at/ui';

/** Branch selector that re-queries the stock page via ?branch=. */
export function BranchFilter({
  branches,
  value,
}: {
  branches: { id: string; name: string }[];
  value?: string;
}) {
  const router = useRouter();
  return (
    <Select
      name="branch"
      defaultValue={value ?? ''}
      aria-label="Filter by branch"
      className="sm:max-w-56"
      onChange={(e) => {
        const v = e.currentTarget.value;
        router.push(v ? `/inventory?branch=${v}` : '/inventory');
      }}
    >
      <option value="">All branches</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </Select>
  );
}
