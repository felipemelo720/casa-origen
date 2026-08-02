import { notFound } from 'next/navigation';

import { productRepository } from '@/server/repositories/product.repository';
import { categoryRepository } from '@/server/repositories/category.repository';
import { extraRepository, tagRepository, ingredientRepository } from '@/server/repositories/catalog-support.repository';
import { ProductForm } from '@/features/admin/product-form';

export const metadata = { title: 'Editar producto' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [product, categories, tags, ingredients, extras] = await Promise.all([
    productRepository.findById(id),
    categoryRepository.findAllForAdmin(),
    tagRepository.findAllActive(),
    ingredientRepository.findAllActive(),
    extraRepository.findAllActive(),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Editar producto</h1>
      <ProductForm
        mode="edit"
        productId={product.id}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        tags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        ingredients={ingredients.map((i) => ({ id: i.id, name: i.name }))}
        extras={extras.map((e) => ({ id: e.id, name: e.name, price: e.price }))}
        defaultValues={{
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription ?? '',
          description: product.description ?? '',
          categoryId: product.categoryId,
          price: product.price,
          offerPrice: product.offerPrice ?? undefined,
          availability: product.availability,
          prepMinutes: product.prepMinutes,
          allowNotes: product.allowNotes,
          sortOrder: product.sortOrder,
          isActive: product.isActive,
          isVisible: product.isVisible,
          isFeatured: product.isFeatured,
          images: product.images.map((image) => ({ url: image.url, alt: image.alt ?? '' })),
          tagIds: product.tags.map((entry) => entry.tag.id),
          ingredients: product.ingredients.map((entry) => ({
            ingredientId: entry.ingredient.id,
            isRemovable: entry.isRemovable,
          })),
          variantGroups: product.variantGroups.map((group) => ({
            name: group.name,
            selectionType: group.selectionType,
            isRequired: group.isRequired,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            options: group.options.map((option) => ({
              name: option.name,
              priceDelta: option.priceDelta,
              isDefault: option.isDefault,
              isAvailable: option.isAvailable,
            })),
          })),
          extras: product.extras.map((entry) => ({
            extraId: entry.extraId,
            priceOverride: entry.priceOverride ?? undefined,
            maxQuantity: entry.maxQuantity,
          })),
        }}
      />
    </div>
  );
}
