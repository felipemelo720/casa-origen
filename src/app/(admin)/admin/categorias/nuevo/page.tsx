import { categoryRepository } from '@/server/repositories/category.repository';
import { CategoryForm } from '@/features/admin/category-form';

export const metadata = { title: 'Nueva categoría' };

export default async function NewCategoryPage() {
  const categories = await categoryRepository.findAllForAdmin();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Nueva categoría</h1>
      <CategoryForm mode="create" parentOptions={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
