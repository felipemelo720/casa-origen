'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/features/admin/form-field';
import { VariantGroupRow } from '@/features/admin/variant-group-row';
import { slugify } from '@/lib/utils';
import { productSchema, type ProductInput } from '@/schemas/product.schema';
import { createProductAction, updateProductAction } from '@/server/actions/product.actions';

type Category = { id: string; name: string };
type Tag = { id: string; name: string; color: string };
type Ingredient = { id: string; name: string };
type Extra = { id: string; name: string; price: number };

const AVAILABILITY_LABEL: Record<ProductInput['availability'], string> = {
  AVAILABLE: 'Disponible',
  OUT_OF_STOCK: 'Agotado',
  SCHEDULED: 'Programado',
};

export function ProductForm({
  mode,
  productId,
  defaultValues,
  categories,
  tags,
  ingredients,
  extras,
}: {
  mode: 'create' | 'edit';
  productId?: string;
  defaultValues?: Partial<ProductInput>;
  categories: Category[];
  tags: Tag[];
  ingredients: Ingredient[];
  extras: Extra[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      slug: '',
      shortDescription: '',
      description: '',
      categoryId: '',
      price: 0,
      offerPrice: undefined,
      availability: 'AVAILABLE',
      prepMinutes: 15,
      allowNotes: true,
      sortOrder: 0,
      isActive: true,
      isVisible: true,
      isFeatured: false,
      images: [],
      tagIds: [],
      ingredients: [],
      variantGroups: [],
      extras: [],
      ...defaultValues,
    },
  });

  const imagesArray = useFieldArray({ control: form.control, name: 'images' });
  const variantGroupsArray = useFieldArray({ control: form.control, name: 'variantGroups' });

  const tagIds = form.watch('tagIds');
  const ingredientLinks = form.watch('ingredients');
  const extraLinks = form.watch('extras');

  function toggleTag(tagId: string) {
    const current = form.getValues('tagIds');
    form.setValue('tagIds', current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]);
  }

  function toggleIngredient(ingredientId: string) {
    const current = form.getValues('ingredients');
    const exists = current.some((entry) => entry.ingredientId === ingredientId);
    form.setValue(
      'ingredients',
      exists
        ? current.filter((entry) => entry.ingredientId !== ingredientId)
        : [...current, { ingredientId, isRemovable: true }],
    );
  }

  function setIngredientRemovable(ingredientId: string, isRemovable: boolean) {
    form.setValue(
      'ingredients',
      form.getValues('ingredients').map((entry) => (entry.ingredientId === ingredientId ? { ...entry, isRemovable } : entry)),
    );
  }

  function toggleExtra(extraId: string) {
    const current = form.getValues('extras');
    const exists = current.some((entry) => entry.extraId === extraId);
    form.setValue(
      'extras',
      exists ? current.filter((entry) => entry.extraId !== extraId) : [...current, { extraId, maxQuantity: 5 }],
    );
  }

  function setExtraField(extraId: string, patch: Partial<{ priceOverride: number | undefined; maxQuantity: number }>) {
    form.setValue(
      'extras',
      form.getValues('extras').map((entry) => (entry.extraId === extraId ? { ...entry, ...patch } : entry)),
    );
  }

  async function onSubmit(values: ProductInput) {
    setSubmitting(true);
    const result =
      mode === 'create' || !productId ? await createProductAction(values) : await updateProductAction({ ...values, id: productId });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ProductInput, { message: messages[0] });
        }
      }
      return;
    }

    toast.success(mode === 'create' ? 'Producto creado.' : 'Producto actualizado.');
    router.push('/admin/productos');
    router.refresh();
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-8 pb-16">
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Información básica</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              {...form.register('name', {
                onChange: (e) => {
                  if (!form.getValues('slug')) form.setValue('slug', slugify(e.target.value));
                },
              })}
            />
          </FormField>
          <FormField label="Slug" htmlFor="slug" error={errors.slug?.message}>
            <div className="flex gap-2">
              <Input id="slug" {...form.register('slug')} />
              <Button type="button" variant="outline" size="icon" onClick={() => form.setValue('slug', slugify(form.getValues('name')))} aria-label="Generar slug">
                <Wand2 className="size-4" />
              </Button>
            </div>
          </FormField>
        </div>

        <FormField label="Descripción corta" htmlFor="shortDescription" error={errors.shortDescription?.message}>
          <Input id="shortDescription" {...form.register('shortDescription')} />
        </FormField>
        <FormField label="Descripción" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" {...form.register('description')} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Categoría" htmlFor="categoryId" error={errors.categoryId?.message}>
            <Select value={form.watch('categoryId') || undefined} onValueChange={(v) => form.setValue('categoryId', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Disponibilidad" htmlFor="availability" error={errors.availability?.message}>
            <Select
              value={form.watch('availability')}
              onValueChange={(v) => form.setValue('availability', v as ProductInput['availability'])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Precio (CLP)" htmlFor="price" error={errors.price?.message}>
            <Input id="price" type="number" {...form.register('price')} />
          </FormField>
          <FormField label="Precio oferta (opcional)" htmlFor="offerPrice" error={errors.offerPrice?.message}>
            <Input id="offerPrice" type="number" {...form.register('offerPrice')} />
          </FormField>
          <FormField label="Preparación (min)" htmlFor="prepMinutes" error={errors.prepMinutes?.message}>
            <Input id="prepMinutes" type="number" {...form.register('prepMinutes')} />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Switch id="isActive" checked={form.watch('isActive')} onCheckedChange={(c) => form.setValue('isActive', c)} />
            <Label htmlFor="isActive">Activo</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="isVisible" checked={form.watch('isVisible')} onCheckedChange={(c) => form.setValue('isVisible', c)} />
            <Label htmlFor="isVisible">Visible en menú</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="isFeatured" checked={form.watch('isFeatured')} onCheckedChange={(c) => form.setValue('isFeatured', c)} />
            <Label htmlFor="isFeatured">Destacado</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="allowNotes" checked={form.watch('allowNotes')} onCheckedChange={(c) => form.setValue('allowNotes', c)} />
            <Label htmlFor="allowNotes">Permite observaciones</Label>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Imágenes</h2>
        {imagesArray.fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input placeholder="URL de la imagen" className="flex-1" {...form.register(`images.${index}.url`)} />
            <Input placeholder="Texto alternativo" className="w-48" {...form.register(`images.${index}.alt`)} />
            <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => imagesArray.remove(index)} aria-label="Quitar imagen">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => imagesArray.append({ url: '', alt: '' })}>
          <Plus className="size-3.5" />
          Agregar imagen
        </Button>
        <p className="text-muted-foreground text-xs">Sin subida de archivos todavía — pega URLs (Unsplash/Vercel Blob).</p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Etiquetas</h2>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && <p className="text-muted-foreground text-sm">No hay etiquetas creadas.</p>}
          {tags.map((tag) => {
            const active = tagIds.includes(tag.id);
            return (
              <button
                type="button"
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className="rounded-full"
              >
                <Badge
                  className="cursor-pointer border-none text-white"
                  style={{ backgroundColor: tag.color, opacity: active ? 1 : 0.35 }}
                >
                  {tag.name}
                </Badge>
              </button>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Ingredientes</h2>
        <div className="space-y-2">
          {ingredients.length === 0 && <p className="text-muted-foreground text-sm">No hay ingredientes creados.</p>}
          {ingredients.map((ingredient) => {
            const link = ingredientLinks.find((entry) => entry.ingredientId === ingredient.id);
            return (
              <div key={ingredient.id} className="flex items-center gap-3 text-sm">
                <label className="flex flex-1 items-center gap-2">
                  <Checkbox checked={Boolean(link)} onCheckedChange={() => toggleIngredient(ingredient.id)} />
                  {ingredient.name}
                </label>
                {link && (
                  <label className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Checkbox checked={link.isRemovable} onCheckedChange={(c) => setIngredientRemovable(ingredient.id, Boolean(c))} />
                    Removible
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Extras</h2>
        </div>
        <div className="space-y-2">
          {extras.length === 0 && <p className="text-muted-foreground text-sm">No hay extras creados.</p>}
          {extras.map((extra) => {
            const link = extraLinks.find((entry) => entry.extraId === extra.id);
            return (
              <div key={extra.id} className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-2 text-sm">
                <label className="flex flex-1 items-center gap-2">
                  <Checkbox checked={Boolean(link)} onCheckedChange={() => toggleExtra(extra.id)} />
                  {extra.name}
                </label>
                {link && (
                  <>
                    <Input
                      type="number"
                      placeholder={`Precio (def. ${extra.price})`}
                      className="w-40"
                      value={link.priceOverride ?? ''}
                      onChange={(e) => setExtraField(extra.id, { priceOverride: e.target.value ? Number(e.target.value) : undefined })}
                    />
                    <Input
                      type="number"
                      placeholder="Cantidad máx."
                      className="w-32"
                      value={link.maxQuantity}
                      onChange={(e) => setExtraField(extra.id, { maxQuantity: Number(e.target.value) })}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Grupos de variantes</h2>
        </div>
        {variantGroupsArray.fields.map((field, index) => (
          <VariantGroupRow
            key={field.id}
            control={form.control}
            register={form.register}
            groupIndex={index}
            selectionType={form.watch(`variantGroups.${index}.selectionType`)}
            onSelectionTypeChange={(v) => form.setValue(`variantGroups.${index}.selectionType`, v)}
            onRemove={() => variantGroupsArray.remove(index)}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            variantGroupsArray.append({
              name: '',
              selectionType: 'SINGLE',
              isRequired: true,
              minSelect: 1,
              maxSelect: 1,
              options: [{ name: '', priceDelta: 0, isDefault: false, isAvailable: true }],
            })
          }
        >
          <Plus className="size-3.5" />
          Agregar grupo de variantes
        </Button>
      </section>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
      </Button>
    </form>
  );
}
