import { notFound } from 'next/navigation';

import { categoryRepository } from '@/server/repositories/category.repository';
import { CategoryForm } from '@/features/admin/category-form';

export const metadata = { title: 'Editar categoría' };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [category, categories] = await Promise.all([
    categoryRepository.findById(id),
    categoryRepository.findAllForAdmin(),
  ]);

  if (!category) notFound();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Editar categoría</h1>
      <CategoryForm
        mode="edit"
        categoryId={category.id}
        defaultValues={{
          name: category.name,
          slug: category.slug,
          description: category.description ?? '',
          image: category.image ?? '',
          icon: category.icon ?? '',
          parentId: category.parentId ?? '',
          isActive: category.isActive,
          sortOrder: category.sortOrder,
        }}
        parentOptions={categories.filter((c) => c.id !== category.id).map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
