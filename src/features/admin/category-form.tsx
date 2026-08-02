'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { categorySchema, type CategoryInput } from '@/schemas/category.schema';
import { createCategoryAction, updateCategoryAction } from '@/server/actions/category.actions';
import { slugify } from '@/lib/utils';

export function CategoryForm({
  mode,
  categoryId,
  defaultValues,
  parentOptions,
}: {
  mode: 'create' | 'edit';
  categoryId?: string;
  defaultValues?: Partial<CategoryInput>;
  parentOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      image: '',
      icon: '',
      parentId: '',
      isActive: true,
      sortOrder: 0,
      ...defaultValues,
    },
  });

  async function onSubmit(values: CategoryInput) {
    setSubmitting(true);
    const result =
      mode === 'create' || !categoryId
        ? await createCategoryAction(values)
        : await updateCategoryAction({ ...values, id: categoryId });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof CategoryInput, { message: messages[0] });
        }
      }
      return;
    }

    toast.success(mode === 'create' ? 'Categoría creada.' : 'Categoría actualizada.');
    router.push('/admin/categorias');
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          {...form.register('name', {
            onChange: (e) => {
              if (!form.getValues('slug')) form.setValue('slug', slugify(e.target.value));
            },
          })}
        />
        {form.formState.errors.name && <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug</Label>
        <div className="flex gap-2">
          <Input id="slug" {...form.register('slug')} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => form.setValue('slug', slugify(form.getValues('name')))}
            aria-label="Generar slug"
          >
            <Wand2 className="size-4" />
          </Button>
        </div>
        {form.formState.errors.slug && <p className="text-destructive text-sm">{form.formState.errors.slug.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" {...form.register('description')} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="image">Imagen (URL)</Label>
        <Input id="image" {...form.register('image')} />
        {form.formState.errors.image && <p className="text-destructive text-sm">{form.formState.errors.image.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Categoría padre</Label>
        <Select
          value={form.watch('parentId') || 'NONE'}
          onValueChange={(value) => form.setValue('parentId', value === 'NONE' ? '' : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Sin categoría padre</SelectItem>
            {parentOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sortOrder">Orden</Label>
        <Input id="sortOrder" type="number" {...form.register('sortOrder')} />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="isActive"
          checked={form.watch('isActive')}
          onCheckedChange={(checked) => form.setValue('isActive', checked)}
        />
        <Label htmlFor="isActive">Activa (visible en el menú)</Label>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {mode === 'create' ? 'Crear categoría' : 'Guardar cambios'}
      </Button>
    </form>
  );
}
