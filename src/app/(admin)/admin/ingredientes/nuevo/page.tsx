import { IngredientForm } from '@/features/admin/ingredient-form';

export const metadata = { title: 'Nuevo ingrediente' };

export default function NewIngredientPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Nuevo ingrediente</h1>
      <IngredientForm mode="create" />
    </div>
  );
}
