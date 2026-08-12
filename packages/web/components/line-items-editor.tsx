'use client';

import { useMemo, useRef, useState } from 'react';
import { Button, Input, Label, Select } from '@at/ui';
import { formatMoney } from '@/lib/format';
import { ProductPicker, productDisplayName, type PickerProduct } from './product-picker';

type Uom = 'unit' | 'carton';

type Line = {
  key: number;
  product: PickerProduct | null;
  uom: Uom;
  qty: string;
  price: string;
};

function defaultPrice(product: PickerProduct, uom: Uom, priceMode: 'sale' | 'purchase') {
  if (priceMode === 'sale') {
    if (uom === 'carton') {
      return product.carton_sale_price ?? (product.sale_price ?? 0) * product.units_per_carton;
    }
    return product.sale_price ?? 0;
  }
  if (uom === 'carton') return (product.purchase_price ?? 0) * product.units_per_carton;
  return product.purchase_price ?? 0;
}

/**
 * Shared order-line editor for sales orders, purchase orders, and quotations.
 * Emits per line: product_id, uom, qty_entered, unit_price (per chosen uom).
 * Price auto-fills from the selected product + uom and stays editable.
 * The scan bar accepts a barcode or SKU (scanners type the code + Enter).
 */
export function LineItemsEditor({
  products,
  priceMode,
  currency,
}: {
  products: PickerProduct[];
  priceMode: 'sale' | 'purchase';
  currency: string;
}) {
  const nextKey = useRef(1);
  const [lines, setLines] = useState<Line[]>([
    { key: 0, product: null, uom: 'unit', qty: '', price: '' },
  ]);
  const [scan, setScan] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  function patchLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function selectProduct(key: number, product: PickerProduct) {
    patchLine(key, {
      product,
      uom: 'unit',
      price: String(defaultPrice(product, 'unit', priceMode)),
    });
  }

  function changeUom(key: number, uom: Uom) {
    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? { ...line, uom, price: line.product ? String(defaultPrice(line.product, uom, priceMode)) : line.price }
          : line,
      ),
    );
  }

  function addLine(product: PickerProduct | null = null) {
    const key = nextKey.current;
    nextKey.current += 1;
    setLines((current) => [
      ...current,
      {
        key,
        product,
        uom: 'unit',
        qty: product ? '1' : '',
        price: product ? String(defaultPrice(product, 'unit', priceMode)) : '',
      },
    ]);
  }

  function handleScan() {
    const code = scan.trim().toLowerCase();
    if (!code) return;
    const product = products.find(
      (p) => (p.barcode ?? '').toLowerCase() === code || p.sku.toLowerCase() === code,
    );
    if (!product) {
      setScanError(`No product with barcode or SKU “${scan.trim()}”.`);
      return;
    }
    setScanError(null);
    const existing = lines.find((line) => line.product?.id === product.id && line.uom === 'unit');
    if (existing) {
      patchLine(existing.key, { qty: String((Number(existing.qty) || 0) + 1) });
    } else {
      const empty = lines.find((line) => !line.product);
      if (empty) {
        patchLine(empty.key, {
          product,
          uom: 'unit',
          qty: '1',
          price: String(defaultPrice(product, 'unit', priceMode)),
        });
      } else {
        addLine(product);
      }
    }
    setScan('');
  }

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.qty);
        const price = Number(line.price);
        if (!line.product || !Number.isFinite(qty) || !Number.isFinite(price)) return sum;
        return sum + Math.round(qty * price * 100) / 100;
      }, 0),
    [lines],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scan_code">Scan / quick add</Label>
        <Input
          id="scan_code"
          value={scan}
          placeholder="Scan a barcode or type a SKU, then press Enter"
          autoComplete="off"
          onChange={(event) => {
            setScan(event.target.value);
            setScanError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleScan();
            }
          }}
        />
        {scanError ? <p className="text-xs text-rose-600">{scanError}</p> : null}
      </div>

      {lines.map((line) => {
        const lineTotal =
          line.product && Number.isFinite(Number(line.qty)) && Number.isFinite(Number(line.price))
            ? Math.round(Number(line.qty) * Number(line.price) * 100) / 100
            : 0;
        const baseQty =
          line.product && line.uom === 'carton'
            ? (Number(line.qty) || 0) * line.product.units_per_carton
            : Number(line.qty) || 0;
        return (
          <div
            key={line.key}
            className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          >
            <div>
              <Label htmlFor={`product_${line.key}`}>Product</Label>
              <ProductPicker
                inputId={`product_${line.key}`}
                products={products}
                selected={line.product}
                onSelect={(product) => selectProduct(line.key, product)}
              />
              {line.product ? (
                <input type="hidden" name="product_id" value={line.product.id} />
              ) : (
                // keeps the positional arrays aligned server-side; rejected by validation
                <input type="hidden" name="product_id" value="" />
              )}
            </div>
            <div>
              <Label htmlFor={`uom_${line.key}`}>Sold as</Label>
              <Select
                id={`uom_${line.key}`}
                name="uom"
                value={line.uom}
                onChange={(event) => changeUom(line.key, event.target.value as Uom)}
              >
                <option value="unit">{line.product?.unit ?? 'unit'}</option>
                {line.product && line.product.units_per_carton > 1 ? (
                  <option value="carton">carton ({line.product.units_per_carton})</option>
                ) : null}
              </Select>
            </div>
            <div>
              <Label htmlFor={`quantity_${line.key}`}>Quantity</Label>
              <Input
                id={`quantity_${line.key}`}
                name="qty_entered"
                type="number"
                min={1}
                step="1"
                required
                value={line.qty}
                onChange={(event) => patchLine(line.key, { qty: event.target.value })}
              />
              {line.product && line.uom === 'carton' && baseQty > 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  = {baseQty} {line.product.unit}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor={`price_${line.key}`}>
                Price / {line.uom === 'carton' ? 'carton' : (line.product?.unit ?? 'unit')}
              </Label>
              <Input
                id={`price_${line.key}`}
                name="unit_price"
                type="number"
                min={0}
                step="0.01"
                required
                value={line.price}
                onChange={(event) => patchLine(line.key, { price: event.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">
                Line: {formatMoney(lineTotal, currency)}
              </p>
            </div>
            <Button
              className="self-end"
              variant="ghost"
              disabled={lines.length === 1}
              onClick={() =>
                setLines((current) => current.filter((item) => item.key !== line.key))
              }
            >
              Remove
            </Button>
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <Button className="w-fit" variant="outline" onClick={() => addLine()}>
          Add line
        </Button>
        <p className="text-sm font-semibold">
          Total: {formatMoney(total, currency)}
        </p>
      </div>
    </div>
  );
}

export { productDisplayName };
export type { PickerProduct };
