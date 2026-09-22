import { categoryRepository } from '@/server/repositories/category.repository';
import { createProductAction } from '@/server/actions/product.actions';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { AdminPageHeader } from '@/features/admin/admin-page-header';
import { NewProductFields } from '@/features/admin/product-fields';

export const metadata = { title: 'Nuevo producto — Admin — Casa Origen' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const categories = await categoryRepository.findAllActive();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader
        title="Producto nuevo"
        back={{ href: '/admin/productos', label: 'Volver a productos' }}
      />

      <div className="max-w-2xl">
        <AdminForm action={createProductAction} className="space-y-5">
          <NewProductFields categories={categories} />
          <AdminSubmit className="h-11 w-full">Crear producto</AdminSubmit>
        </AdminForm>
      </div>
    </div>
  );
}
