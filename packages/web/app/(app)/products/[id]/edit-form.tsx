'use client';
import { useActionState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@at/ui';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { setProductStatusAction, updateProductAction, type ProductActionState } from '../actions';
import { ProductFields, type CategoryOption, type ProductValues } from '../product-fields';
const initial: ProductActionState = {};
type ProductRecord = ProductValues & {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  category_id: string | null;
  purchase_price: number;
  sale_price: number;
  units_per_carton: number;
  carton_sale_price: number | null;
  status: string;
};
export function ProductEditForm({
  product,
  categories,
}: {
  product: ProductRecord;
  categories: CategoryOption[];
}) {
  const [state, action] = useActionState(updateProductAction, initial);
  const [statusState, statusAction] = useActionState(setProductStatusAction, initial);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>Edit catalog classification and prices.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <input type="hidden" name="product_id" value={product.id} />
          <ProductFields categories={categories} values={product} />
          <SubmitButton className="w-fit">Save changes</SubmitButton>
        </form>
        <form
          action={statusAction}
          className="flex items-center gap-3 border-t border-slate-100 pt-4"
        >
          <FormAlert error={statusState.error} message={statusState.message} />
          <input type="hidden" name="product_id" value={product.id} />
          <input
            type="hidden"
            name="status"
            value={product.status === 'active' ? 'archived' : 'active'}
          />
          <SubmitButton variant={product.status === 'active' ? 'danger' : 'secondary'} size="sm">
            {product.status === 'active' ? 'Archive product' : 'Restore product'}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
