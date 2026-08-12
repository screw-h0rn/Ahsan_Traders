'use server';

import { revalidatePath } from 'next/cache';
import { nameSchema, uuidSchema, z } from '@at/shared';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';

export type BranchActionState = { error?: string; message?: string };

const branchSchema = z.object({
  name: nameSchema,
  type: z.enum(['branch', 'warehouse']),
});

function parseBranch(formData: FormData) {
  return branchSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type') ?? 'branch',
  });
}

export async function createBranchAction(
  _prev: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const caller = await requirePermission('branches.manage');
  if (!caller) return { error: 'You are not allowed to manage branches.' };

  const parsed = parseBranch(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }

  const supabase = await createClient();
  // tenant_id defaults to current_tenant_id() in the database.
  const { error } = await supabase.from('branches').insert({
    name: parsed.data.name,
    type: parsed.data.type,
  });
  if (error) {
    return {
      error: error.message.includes('duplicate')
        ? 'A branch with that name already exists.'
        : error.message,
    };
  }

  revalidatePath('/branches');
  revalidatePath('/inventory');
  return { message: `Branch “${parsed.data.name}” added.` };
}

export async function updateBranchAction(
  _prev: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const caller = await requirePermission('branches.manage');
  if (!caller) return { error: 'You are not allowed to manage branches.' };

  const id = uuidSchema.safeParse(formData.get('branch_id'));
  if (!id.success) return { error: 'Invalid branch.' };

  const parsed = parseBranch(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('branches')
    .update({ name: parsed.data.name, type: parsed.data.type })
    .eq('id', id.data);
  if (error) {
    return {
      error: error.message.includes('duplicate')
        ? 'A branch with that name already exists.'
        : error.message,
    };
  }

  revalidatePath('/branches');
  revalidatePath(`/branches/${id.data}`);
  revalidatePath('/inventory');
  return { message: 'Branch updated.' };
}

export async function setBranchStatusAction(
  _prev: BranchActionState,
  formData: FormData,
): Promise<BranchActionState> {
  const caller = await requirePermission('branches.manage');
  if (!caller) return { error: 'You are not allowed to manage branches.' };

  const id = uuidSchema.safeParse(formData.get('branch_id'));
  const status = String(formData.get('status') ?? '');
  if (!id.success || !['active', 'archived'].includes(status)) {
    return { error: 'Invalid request.' };
  }

  const supabase = await createClient();

  if (status === 'archived') {
    // A tenant must always keep at least one active branch to operate in.
    const { count } = await supabase
      .from('branches')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .neq('id', id.data);
    if (!count) return { error: 'You cannot archive the last active branch.' };

    // Stock left in an archived branch becomes invisible to operations —
    // require it to be transferred or adjusted out first.
    const { data: stocked } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('branch_id', id.data)
      .gt('quantity', 0)
      .limit(1);
    if (stocked?.length) {
      return { error: 'Move or adjust out the remaining stock before archiving this branch.' };
    }
  }

  const { error } = await supabase
    .from('branches')
    .update({ status: status as 'active' | 'archived' })
    .eq('id', id.data);
  if (error) return { error: error.message };

  revalidatePath('/branches');
  revalidatePath(`/branches/${id.data}`);
  revalidatePath('/inventory');
  return { message: status === 'archived' ? 'Branch archived.' : 'Branch restored.' };
}
