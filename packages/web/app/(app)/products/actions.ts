'use server';

import { revalidatePath } from 'next/cache';
import { nameSchema, uuidSchema, z } from '@at/shared';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PRODUCT_IMAGE_BUCKET } from '@/lib/product-image';

export type ProductActionState = { error?: string; message?: string };

const barcodeSchema = z.preprocess(
  (v) => (v == null || String(v).trim() === '' ? null : String(v).trim()),
  z.string().max(100).nullable(),
);
const unitsPerCartonSchema = z.coerce
  .number()
  .int('Units per carton must be a whole number')
  .min(1, 'Units per carton must be at least 1')
  .default(1);
const cartonSalePriceSchema = z.preprocess(
  (v) => (v == null || String(v).trim() === '' ? null : v),
  z.coerce.number().finite().min(0, 'Carton sale price cannot be negative').nullable(),
);

const productSchema = z.object({
  name: nameSchema,
  sku: z.string().trim().min(1, 'SKU is required').max(100),
  barcode: barcodeSchema,
  unit: z.string().trim().min(1, 'Unit is required').max(50),
  category_id: z.preprocess((v) => (v === '' || v == null ? null : v), uuidSchema.nullable()),
  purchase_price: z.coerce.number().finite().min(0, 'Purchase price cannot be negative'),
  sale_price: z.coerce.number().finite().min(0, 'Sale price cannot be negative'),
  units_per_carton: unitsPerCartonSchema,
  carton_sale_price: cartonSalePriceSchema,
});

function parseProduct(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get('name'),
    sku: formData.get('sku'),
    barcode: formData.get('barcode'),
    unit: formData.get('unit'),
    category_id: formData.get('category_id'),
    purchase_price: formData.get('purchase_price') || 0,
    sale_price: formData.get('sale_price') || 0,
    units_per_carton: formData.get('units_per_carton') || 1,
    carton_sale_price: formData.get('carton_sale_price'),
  });
}

async function categoryIsActive(id: string | null) {
  if (!id) return true;
  const supabase = await createClient();
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();
  return Boolean(data);
}

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  if (!(await requirePermission('catalog.manage')))
    return { error: 'You are not allowed to manage products.' };
  const parsed = parseProduct(formData);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  if (!(await categoryIsActive(parsed.data.category_id)))
    return { error: 'Choose an active category.' };
  const supabase = await createClient();
  const { error } = await supabase.from('products').insert(parsed.data);
  if (error)
    return {
      error: error.code === '23505' ? 'That SKU or barcode is already in use.' : error.message,
    };
  revalidatePath('/products');
  return { message: `Product “${parsed.data.name}” added.` };
}

export async function updateProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  if (!(await requirePermission('catalog.manage')))
    return { error: 'You are not allowed to manage products.' };
  const id = uuidSchema.safeParse(formData.get('product_id'));
  const parsed = parseProduct(formData);
  if (!id.success) return { error: 'Invalid product.' };
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  if (!(await categoryIsActive(parsed.data.category_id)))
    return { error: 'Choose an active category.' };
  const supabase = await createClient();
  const { error } = await supabase.from('products').update(parsed.data).eq('id', id.data);
  if (error)
    return {
      error: error.code === '23505' ? 'That SKU or barcode is already in use.' : error.message,
    };
  revalidatePath('/products');
  revalidatePath(`/products/${id.data}`);
  return { message: 'Product updated.' };
}

/**
 * Record the storage path of a product's photo (or clear it), and delete
 * whatever file was there before — a straight replace, not an accumulating
 * history, so the bucket does not fill up with orphaned uploads over time.
 *
 * The upload itself already happened client-side, straight to Storage, before
 * this is called; this action only ever touches the `products` row and the
 * previous file.
 */
export async function setProductImageAction(
  productId: string,
  imagePath: string | null,
): Promise<ProductActionState> {
  if (!(await requirePermission('catalog.manage')))
    return { error: 'You are not allowed to manage products.' };

  const id = uuidSchema.safeParse(productId);
  if (!id.success) return { error: 'Invalid product.' };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('products')
    .select('image_path')
    .eq('id', id.data)
    .maybeSingle();

  const { error } = await supabase
    .from('products')
    .update({ image_path: imagePath })
    .eq('id', id.data);
  if (error) return { error: error.message };

  if (existing?.image_path && existing.image_path !== imagePath) {
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([existing.image_path]);
  }

  revalidatePath('/products');
  revalidatePath(`/products/${id.data}`);
  return { message: imagePath ? 'Photo updated.' : 'Photo removed.' };
}

const variantSchema = z.object({
  parent_product_id: uuidSchema,
  variant_label: z.string().trim().min(1, 'Variant label is required').max(50),
  sku: z.string().trim().min(1, 'SKU is required').max(100),
  barcode: barcodeSchema,
  purchase_price: z.coerce.number().finite().min(0, 'Purchase price cannot be negative'),
  sale_price: z.coerce.number().finite().min(0, 'Sale price cannot be negative'),
  carton_sale_price: cartonSalePriceSchema,
  units_per_carton: unitsPerCartonSchema,
});

export async function createVariantAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  if (!(await requirePermission('catalog.manage')))
    return { error: 'You are not allowed to manage products.' };
  const parsed = variantSchema.safeParse({
    parent_product_id: formData.get('parent_product_id'),
    variant_label: formData.get('variant_label'),
    sku: formData.get('sku'),
    barcode: formData.get('barcode'),
    purchase_price: formData.get('purchase_price') || 0,
    sale_price: formData.get('sale_price') || 0,
    carton_sale_price: formData.get('carton_sale_price'),
    units_per_carton: formData.get('units_per_carton') || 1,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  const supabase = await createClient();
  const { data: parent } = await supabase
    .from('products')
    .select('id,name,unit,category_id,parent_product_id')
    .eq('id', parsed.data.parent_product_id)
    .maybeSingle();
  if (!parent) return { error: 'Parent product not found.' };
  if (parent.parent_product_id)
    return { error: 'Variants of variants are not allowed. Add the variant to the parent product.' };
  const { error } = await supabase.from('products').insert({
    name: parent.name,
    unit: parent.unit,
    category_id: parent.category_id,
    parent_product_id: parent.id,
    variant_label: parsed.data.variant_label,
    sku: parsed.data.sku,
    barcode: parsed.data.barcode,
    purchase_price: parsed.data.purchase_price,
    sale_price: parsed.data.sale_price,
    carton_sale_price: parsed.data.carton_sale_price,
    units_per_carton: parsed.data.units_per_carton,
  });
  if (error)
    return {
      error: error.code === '23505' ? 'That SKU or barcode is already in use.' : error.message,
    };
  revalidatePath('/products');
  revalidatePath(`/products/${parent.id}`);
  return { message: `Variant “${parsed.data.variant_label}” added.` };
}

export async function setProductStatusAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  if (!(await requirePermission('catalog.manage')))
    return { error: 'You are not allowed to manage products.' };
  const id = uuidSchema.safeParse(formData.get('product_id'));
  const status = String(formData.get('status') ?? '');
  if (!id.success || !['active', 'archived'].includes(status)) return { error: 'Invalid request.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ status: status as 'active' | 'archived' })
    .eq('id', id.data);
  if (error) return { error: error.message };
  revalidatePath('/products');
  revalidatePath(`/products/${id.data}`);
  return { message: status === 'archived' ? 'Product archived.' : 'Product restored.' };
}
