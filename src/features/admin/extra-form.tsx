'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FormField } from '@/features/admin/form-field';
import { slugify } from '@/lib/utils';
import { extraSchema, type ExtraInput } from '@/schemas/catalog-support.schema';
import { createExtraAction, updateExtraAction } from '@/server/actions/catalog-support.actions';

export function ExtraForm({
  mode,
  extraId,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  extraId?: string;
  defaultValues?: Partial<ExtraInput>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ExtraInput>({
    resolver: zodResolver(extraSchema),
    defaultValues: { name: '', slug: '', description: '', price: 0, isActive: true, sortOrder: 0, ...defaultValues },
  });

  async function onSubmit(values: ExtraInput) {
    setSubmitting(true);
    const result =
      mode === 'create' || !extraId ? await createExtraAction(values) : await updateExtraAction({ ...values, id: extraId });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ExtraInput, { message: messages[0] });
        }
      }
      return;
    }

    toast.success(mode === 'create' ? 'Extra creado.' : 'Extra actualizado.');
    router.push('/admin/extras');
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

      <FormField label="Descripción" htmlFor="description" error={form.formState.errors.description?.message}>
        <Textarea id="description" {...form.register('description')} />
      </FormField>

      <FormField label="Precio (CLP)" htmlFor="price" error={form.formState.errors.price?.message}>
        <Input id="price" type="number" {...form.register('price')} />
      </FormField>

      <FormField label="Orden" htmlFor="sortOrder" error={form.formState.errors.sortOrder?.message}>
        <Input id="sortOrder" type="number" {...form.register('sortOrder')} />
      </FormField>

      <div className="flex items-center gap-2">
        <Switch id="isActive" checked={form.watch('isActive')} onCheckedChange={(checked) => form.setValue('isActive', checked)} />
        <Label htmlFor="isActive">Activo</Label>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {mode === 'create' ? 'Crear extra' : 'Guardar cambios'}
      </Button>
    </form>
  );
}
