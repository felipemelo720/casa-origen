import { notFound } from 'next/navigation';

import { ingredientRepository } from '@/server/repositories/catalog-support.repository';
import { IngredientForm } from '@/features/admin/ingredient-form';

export const metadata = { title: 'Editar ingrediente' };

export default async function EditIngredientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ingredient = await ingredientRepository.findById(id);
  if (!ingredient) notFound();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Editar ingrediente</h1>
      <IngredientForm
        mode="edit"
        ingredientId={ingredient.id}
        defaultValues={{ name: ingredient.name, slug: ingredient.slug, isAllergen: ingredient.isAllergen, isActive: ingredient.isActive }}
      />
    </div>
  );
}
