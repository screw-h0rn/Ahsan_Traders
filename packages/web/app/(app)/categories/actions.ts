'use server';

import { revalidatePath } from 'next/cache';
import { nameSchema, uuidSchema, z } from '@at/shared';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type CategoryActionState = { error?: string; message?: string };

const optionalParentSchema = z.preprocess(
  (value) => (value === '' || value == null ? null : value),
  uuidSchema.nullable(),
);

const categorySchema = z.object({
  name: nameSchema,
  parent_id: optionalParentSchema,
});

function parseCategory(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get('name'),
    parent_id: formData.get('parent_id'),
  });
}

export async function createCategoryAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const caller = await requirePermission('catalog.manage');
  if (!caller) return { error: 'You are not allowed to manage categories.' };

  const parsed = parseCategory(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('categories').insert(parsed.data);
  if (error) return { error: error.message };

  revalidatePath('/categories');
  return { message: `Category “${parsed.data.name}” added.` };
}

export async function updateCategoryAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const caller = await requirePermission('catalog.manage');
  if (!caller) return { error: 'You are not allowed to manage categories.' };

  const id = uuidSchema.safeParse(formData.get('category_id'));
  const parsed = parseCategory(formData);
  if (!id.success) return { error: 'Invalid category.' };
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }
  if (parsed.data.parent_id === id.data) {
    return { error: 'A category cannot be its own parent.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('categories').update(parsed.data).eq('id', id.data);
  if (error) return { error: error.message };

  revalidatePath('/categories');
  revalidatePath(`/categories/${id.data}`);
  return { message: 'Category updated.' };
}

export async function setCategoryStatusAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const caller = await requirePermission('catalog.manage');
  if (!caller) return { error: 'You are not allowed to manage categories.' };

  const id = uuidSchema.safeParse(formData.get('category_id'));
  const status = String(formData.get('status') ?? '');
  if (!id.success || !['active', 'archived'].includes(status)) {
    return { error: 'Invalid request.' };
  }

  const supabase = await createClient();
  if (status === 'archived') {
    const { count: productCount, error: productError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id.data)
      .eq('status', 'active');
    if (productError) return { error: productError.message };
    if ((productCount ?? 0) > 0) {
      return { error: 'Move or archive active products in this category first.' };
    }

    const { count, error: childError } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id.data)
      .eq('status', 'active');
    if (childError) return { error: childError.message };
    if ((count ?? 0) > 0) {
      return { error: 'Archive or move active child categories first.' };
    }
  }

  const { error } = await supabase
    .from('categories')
    .update({ status: status as 'active' | 'archived' })
    .eq('id', id.data);
  if (error) return { error: error.message };

  revalidatePath('/categories');
  revalidatePath(`/categories/${id.data}`);
  return { message: status === 'archived' ? 'Category archived.' : 'Category restored.' };
}
