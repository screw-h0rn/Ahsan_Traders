'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Button } from '@at/ui';
import { createClient } from '@/lib/supabase/client';
import {
  ALLOWED_PRODUCT_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_BUCKET,
  newProductImagePath,
} from '@/lib/product-image';
import { setProductImageAction } from '../actions';

/**
 * Product photo. Many shopkeepers ordering through the mobile app recognise a
 * product by its picture faster than by reading its name, so this is not a
 * cosmetic extra — it is how the catalogue will actually be browsed.
 *
 * The upload goes straight from the browser to Supabase Storage using the
 * signed-in session (RLS on the bucket only allows owner/manager to write),
 * then a tiny server action records the resulting path on the product row and
 * removes the previous file so orphaned images do not pile up.
 */
export function ProductImageUpload({
  productId,
  imageUrl,
  productName,
}: {
  productId: string;
  imageUrl: string | null;
  productName: string;
}) {
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_PRODUCT_IMAGE_TYPES)[number])) {
      setError('Use a JPEG, PNG or WEBP image.');
      return;
    }
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      setError('Image is larger than 5 MB — please use a smaller photo.');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    startTransition(async () => {
      const supabase = createClient();
      const path = newProductImagePath(productId, file.name);

      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        setPreview(imageUrl);
        return;
      }

      const result = await setProductImageAction(productId, path);
      if (result.error) {
        setError(result.error);
        // Best-effort cleanup of the file we just uploaded but could not attach.
        await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
        setPreview(imageUrl);
      }
    });
  }

  async function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await setProductImageAction(productId, null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPreview(null);
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {preview ? (
          <Image
            src={preview}
            alt={productName}
            width={96}
            height={96}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="px-2 text-center text-xs text-slate-400">No photo</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_PRODUCT_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? 'Uploading…' : preview ? 'Replace photo' : 'Upload photo'}
          </Button>
          {preview ? (
            <Button type="button" variant="danger" size="sm" disabled={pending} onClick={handleRemove}>
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">JPEG, PNG or WEBP, up to 5 MB.</p>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
