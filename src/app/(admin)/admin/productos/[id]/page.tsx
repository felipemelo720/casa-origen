import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { productRepository } from '@/server/repositories/product.repository';
import { categoryRepository } from '@/server/repositories/category.repository';
import { updateProductAction } from '@/server/actions/product.actions';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { ProductFields } from '@/features/admin/product-fields';
import { Button } from '@/components/ui/button';

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
    <main className="min-h-dvh pb-12">
      <header className="border-border bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4">
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link href="/admin/productos" aria-label="Volver a productos">
              <ArrowLeft aria-hidden="true" />
            </Link>
          </Button>
          <h1 className="font-display truncate text-xl font-bold">{product.name}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
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
              options: (variantGroup?.options ?? []).map((option) => ({
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
    </main>
  );
}
