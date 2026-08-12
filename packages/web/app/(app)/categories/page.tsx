import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CategoryForm } from './category-form';

type CategoryRow = {
  id: string;
  name: string;
  parent_id: string | null;
  status: 'active' | 'archived';
};

function orderTree(categories: CategoryRow[]) {
  const children = new Map<string | null, CategoryRow[]>();
  for (const category of categories) {
    const siblings = children.get(category.parent_id) ?? [];
    siblings.push(category);
    children.set(category.parent_id, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name));
  }

  const ordered: Array<CategoryRow & { depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const category of children.get(parentId) ?? []) {
      ordered.push({ ...category, depth });
      visit(category.id, depth + 1);
    }
  };
  visit(null, 0);
  return ordered;
}

export default async function CategoriesPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'catalog.view')) redirect('/dashboard');

  const supabase = await createClient();
  const { data } = await supabase
    .from('categories')
    .select('id, name, parent_id, status')
    .order('name');

  const categories = (data ?? []) as CategoryRow[];
  const ordered = orderTree(categories);
  const activeParents = categories
    .filter((category) => category.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name));
  const canManage = can(caller, 'catalog.manage');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Categories</h1>
        <p className="text-slate-500">Organize products into a simple hierarchy.</p>
      </div>

      {canManage && <CategoryForm parents={activeParents} />}

      <Card>
        <CardHeader>
          <CardTitle>Category tree</CardTitle>
          <CardDescription>
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {ordered.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">
              No categories yet. Add your first category to organize the product catalog.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {ordered.map((category) => (
                <div key={category.id} className="flex items-center justify-between px-5 py-3">
                  <Link
                    href={`/categories/${category.id}`}
                    className="font-medium text-brand-700 hover:underline"
                    style={{ paddingLeft: `${category.depth * 1.5}rem` }}
                  >
                    {category.depth > 0 && <span className="mr-2 text-slate-400">↳</span>}
                    {category.name}
                  </Link>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-medium',
                      category.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {category.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
