'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FormField } from '@/features/admin/form-field';
import { slugify } from '@/lib/utils';
import { ingredientSchema, type IngredientInput } from '@/schemas/catalog-support.schema';
import { createIngredientAction, updateIngredientAction } from '@/server/actions/catalog-support.actions';

export function IngredientForm({
  mode,
  ingredientId,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  ingredientId?: string;
  defaultValues?: Partial<IngredientInput>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<IngredientInput>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: { name: '', slug: '', isAllergen: false, isActive: true, ...defaultValues },
  });

  async function onSubmit(values: IngredientInput) {
    setSubmitting(true);
    const result =
      mode === 'create' || !ingredientId
        ? await createIngredientAction(values)
        : await updateIngredientAction({ ...values, id: ingredientId });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof IngredientInput, { message: messages[0] });
        }
      }
      return;
    }

    toast.success(mode === 'create' ? 'Ingrediente creado.' : 'Ingrediente actualizado.');
    router.push('/admin/ingredientes');
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
      <FormField label="Nombre" htmlFor="name" error={form.formState.errors.name?.message}>
        <Input
          id="name"
          {...form.register('name', {
            onChange: (e) => {
              if (!form.getValues('slug')) form.setValue('slug', slugify(e.target.value));
            },
          })}
        />
      </FormField>

      <FormField label="Slug" htmlFor="slug" error={form.formState.errors.slug?.message}>
        <div className="flex gap-2">
          <Input id="slug" {...form.register('slug')} />
          <Button type="button" variant="outline" size="icon" onClick={() => form.setValue('slug', slugify(form.getValues('name')))} aria-label="Generar slug">
            <Wand2 className="size-4" />
          </Button>
        </div>
      </FormField>

      <div className="flex items-center gap-2">
        <Switch id="isAllergen" checked={form.watch('isAllergen')} onCheckedChange={(checked) => form.setValue('isAllergen', checked)} />
        <Label htmlFor="isAllergen">Es alérgeno común</Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="isActive" checked={form.watch('isActive')} onCheckedChange={(checked) => form.setValue('isActive', checked)} />
        <Label htmlFor="isActive">Activo</Label>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {mode === 'create' ? 'Crear ingrediente' : 'Guardar cambios'}
      </Button>
    </form>
  );
}
