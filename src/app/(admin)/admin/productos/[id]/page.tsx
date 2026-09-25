import { notFound } from 'next/navigation';

import { productRepository } from '@/server/repositories/product.repository';
import { categoryRepository } from '@/server/repositories/category.repository';
import { updateProductAction } from '@/server/actions/product.actions';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { AdminPageHeader } from '@/features/admin/admin-page-header';
import { ProductFields } from '@/features/admin/product-fields';

export const metadata = { title: 'Editar producto — Admin — Casa Origen' };
export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    productRepository.findByIdForAdmin(id),
    categoryRepository.findAllActive(),
  ]);

  if (!product) notFound();

  const variantGroup = product.variantGroups[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader
        title={product.name}
        back={{ href: '/admin/productos', label: 'Volver a productos' }}
      />

      <div className="max-w-2xl">
        <AdminForm action={updateProductAction.bind(null, product.id)} className="space-y-5">
          <ProductFields
            categories={categories}
            product={{
              name: product.name,
              slug: product.slug,
              image: product.image,
              categoryId: product.categoryId,
              shortDescription: product.shortDescription,
              description: product.description,
              price: product.price,
              offerPrice: product.offerPrice,
              prepMinutes: product.prepMinutes,
              allowNotes: product.allowNotes,
              isVisible: product.isVisible,
              variantGroupName: variantGroup?.name ?? null,
              variantsLocked: product.variantGroups.length > 1,
              options: (variantGroup?.options ?? []).map((option) => ({
                id: option.id,
                name: option.name,
                priceDelta: option.priceDelta,
                extraPrice: option.extraPrice,
                extraPremiumPrice: option.extraPremiumPrice,
                isAvailable: option.isAvailable,
              })),
            }}
          />
          <AdminSubmit className="h-11 w-full">Guardar cambios</AdminSubmit>
        </AdminForm>
      </div>
    </div>
  );
}
