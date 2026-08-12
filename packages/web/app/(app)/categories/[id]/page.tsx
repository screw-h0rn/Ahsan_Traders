import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CategoryEditForm } from './edit-form';

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'catalog.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: category }, { data: categories }] = await Promise.all([
    supabase.from('categories').select('id, name, parent_id, status').eq('id', id).maybeSingle(),
    supabase
      .from('categories')
      .select('id, name, parent_id, status')
      .eq('status', 'active')
      .order('name'),
  ]);

  if (!category) notFound();
  const parent = categories?.find((item) => item.id === category.parent_id);
  const parentOptions = (categories ?? [])
    .filter((item) => item.id !== category.id)
    .map((item) => ({ id: item.id, name: item.name }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/categories" className="text-sm text-brand-600 hover:underline">
          ← Categories
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{category.name}</h1>
        <p className="text-slate-500">
          {parent ? `Nested under ${parent.name}` : 'Top-level category'} · {category.status}
        </p>
      </div>

      {can(caller, 'catalog.manage') && (
        <CategoryEditForm category={category} parents={parentOptions} />
      )}
    </div>
  );
}
