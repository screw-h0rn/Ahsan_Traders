'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@at/ui';

export type PickerProduct = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  barcode?: string | null;
  variant_label?: string | null;
  units_per_carton: number;
  sale_price?: number;
  carton_sale_price?: number | null;
  purchase_price?: number;
};

export function productDisplayName(product: PickerProduct) {
  return product.variant_label ? `${product.name} — ${product.variant_label}` : product.name;
}

/**
 * Searchable product combobox: type a name, SKU, or barcode and pick with
 * mouse or arrow keys + Enter. Submits nothing itself — the parent renders
 * the hidden form inputs from the selected product.
 */
export function ProductPicker({
  products,
  selected,
  onSelect,
  inputId,
  placeholder = 'Search name, SKU, or barcode…',
}: {
  products: PickerProduct[];
  selected: PickerProduct | null;
  onSelect: (product: PickerProduct) => void;
  inputId?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          productDisplayName(p).toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase() === q,
      )
      .slice(0, 30);
  }, [products, query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function choose(product: PickerProduct) {
    onSelect(product);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={inputId}
        value={open ? query : selected ? `${productDisplayName(selected)} · ${selected.sku}` : ''}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            if (matches[highlight]) choose(matches[highlight]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3.5 py-2 text-slate-500">No products match.</li>
          ) : (
            matches.map((product, index) => (
              <li key={product.id}>
                <button
                  type="button"
                  className={`flex w-full items-baseline justify-between gap-2 px-3.5 py-2 text-left ${
                    index === highlight ? 'bg-slate-100' : ''
                  }`}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(product);
                  }}
                >
                  <span className="truncate">{productDisplayName(product)}</span>
                  <span className="shrink-0 text-xs text-slate-500">{product.sku}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
