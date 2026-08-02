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
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/features/admin/form-field';
import { slugify } from '@/lib/utils';
import { tagSchema, type TagInput } from '@/schemas/catalog-support.schema';
import { createTagAction, updateTagAction } from '@/server/actions/catalog-support.actions';

export function TagForm({
  mode,
  tagId,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  tagId?: string;
  defaultValues?: Partial<TagInput>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TagInput>({
    resolver: zodResolver(tagSchema),
    defaultValues: { name: '', slug: '', color: '#e2725b', isActive: true, sortOrder: 0, ...defaultValues },
  });

  async function onSubmit(values: TagInput) {
    setSubmitting(true);
    const result = mode === 'create' || !tagId ? await createTagAction(values) : await updateTagAction({ ...values, id: tagId });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof TagInput, { message: messages[0] });
        }
      }
      return;
    }

    toast.success(mode === 'create' ? 'Etiqueta creada.' : 'Etiqueta actualizada.');
    router.push('/admin/etiquetas');
    router.refresh();
  }

  const color = form.watch('color');

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

      <FormField label="Color" htmlFor="color" error={form.formState.errors.color?.message}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#e2725b'}
            onChange={(e) => form.setValue('color', e.target.value)}
            className="border-border size-9 shrink-0 rounded-md border"
          />
          <Input id="color" {...form.register('color')} className="max-w-32" />
          <Badge className="border-none text-white" style={{ backgroundColor: color }}>
            {form.watch('name') || 'Vista previa'}
          </Badge>
        </div>
      </FormField>

      <FormField label="Orden" htmlFor="sortOrder" error={form.formState.errors.sortOrder?.message}>
        <Input id="sortOrder" type="number" {...form.register('sortOrder')} />
      </FormField>

      <div className="flex items-center gap-2">
        <Switch id="isActive" checked={form.watch('isActive')} onCheckedChange={(checked) => form.setValue('isActive', checked)} />
        <Label htmlFor="isActive">Activa</Label>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {mode === 'create' ? 'Crear etiqueta' : 'Guardar cambios'}
      </Button>
    </form>
  );
}
