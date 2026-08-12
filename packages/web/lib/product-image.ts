import { publicEnv } from './env';

export const PRODUCT_IMAGE_BUCKET = 'product-images';
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024; // matches the bucket's file_size_limit
export const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Build the public URL for a stored product image.
 *
 * The bucket is public (see 20260101001600_product_images.sql — product
 * photos are not sensitive, unlike invoices), so this is pure string
 * concatenation, not a signed-URL call: no network round trip, and the same
 * URL works from the web portal, the field app and the customer app alike.
 */
export function productImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${imagePath}`;
}

/** A fresh, collision-proof object path for a new upload: `<productId>/<timestamp>.<ext>`. */
export function newProductImagePath(productId: string, fileName: string): string {
  const ext = (fileName.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${productId}/${Date.now()}.${ext}`;
}
