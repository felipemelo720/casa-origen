import { categoryRepository } from '@/server/repositories/category.repository';
import { extraRepository, tagRepository, ingredientRepository } from '@/server/repositories/catalog-support.repository';
import { ProductForm } from '@/features/admin/product-form';

export const metadata = { title: 'Nuevo producto' };

export default async function NewProductPage() {
  const [categories, tags, ingredients, extras] = await Promise.all([
    categoryRepository.findAllForAdmin(),
    tagRepository.findAllActive(),
    ingredientRepository.findAllActive(),
    extraRepository.findAllActive(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Nuevo producto</h1>
      <ProductForm
        mode="create"
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        tags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        ingredients={ingredients.map((i) => ({ id: i.id, name: i.name }))}
        extras={extras.map((e) => ({ id: e.id, name: e.name, price: e.price }))}
      />
    </div>
  );
}
