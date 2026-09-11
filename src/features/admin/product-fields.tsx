import type { ReactNode } from 'react';
import Image from 'next/image';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MAX_VARIANT_OPTIONS } from '@/schemas/product.schema';
import { formatMoney } from '@/lib/money';

type OptionValues = {
  name: string;
  priceDelta: number;
  extraPrice: number | null;
  extraPremiumPrice: number | null;
  isAvailable: boolean;
};

type ProductFieldsValues = {
  name: string;
  slug: string;
  image: string | null;
  categoryId: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  offerPrice: number | null;
  prepMinutes: number;
  allowNotes: boolean;
  isVisible: boolean;
  variantGroupName: string | null;
  options: OptionValues[];
};

/**
 * Campos de un producto, para alta y edición. Mismo criterio que
 * `CouponFields`: server component, `<select>`/`<input>` nativos, 44px de
 * alto, una columna a 360px — sin JS que lo justifique, el panel sigue
 * funcionando aunque el celular vaya lento.
 *
 * Las opciones de tamaño van en filas fijas (`MAX_VARIANT_OPTIONS`), no
 * dinámicas: agregar/quitar filas con JS de cliente es exactamente el costo
 * que este panel evita en todos lados (ver `ScheduleDayRow`, `ZoneRow`).
 */
export function ProductFields({
  product,
  categories,
}: {
  product?: ProductFieldsValues;
  categories: { id: string; name: string }[];
}) {
  const options = product?.options ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <Input
            name="name"
            required
            maxLength={80}
            placeholder="Pizza Pepperoni"
            defaultValue={product?.name}
            className="h-11"
          />
        </Field>

        <Field label="Slug" hint="Vacío = se genera del nombre.">
          <Input
            name="slug"
            maxLength={96}
            placeholder="pizza-pepperoni"
            defaultValue={product?.slug}
            className="h-11 font-mono"
          />
        </Field>

        <Field label="Categoría">
          <select
            name="categoryId"
            required
            defaultValue={product?.categoryId ?? ''}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-11 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
          >
            <option value="" disabled>
              Elige una categoría
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Descripción corta" hint="Se ve en la tarjeta del menú.">
          <Input
            name="shortDescription"
            maxLength={160}
            placeholder="Salsa, mozzarella, pepperoni"
            defaultValue={product?.shortDescription ?? undefined}
            className="h-11"
          />
        </Field>

        <Field label="Precio">
          <Input
            name="price"
            inputMode="numeric"
            required
            placeholder="6.000"
            defaultValue={product ? formatMoney(product.price) : undefined}
            className="h-11"
          />
        </Field>

        <Field label="Precio de oferta" hint="Opcional. Debe ser menor al precio normal.">
          <Input
            name="offerPrice"
            inputMode="numeric"
            placeholder="Sin oferta"
            defaultValue={product?.offerPrice ? formatMoney(product.offerPrice) : undefined}
            className="h-11"
          />
        </Field>

        <Field label="Minutos de preparación">
          <Input
            name="prepMinutes"
            inputMode="numeric"
            defaultValue={product ? product.prepMinutes : 15}
            className="h-11"
          />
        </Field>

        <Field label="Foto" hint="Desde la cámara o la galería del teléfono.">
          <input
            type="file"
            name="image"
            accept="image/*"
            className="text-muted-foreground file:bg-secondary file:text-secondary-foreground h-11 w-full rounded-md text-sm file:mr-3 file:h-11 file:rounded-md file:border-0 file:px-3 file:text-sm file:font-medium"
          />
          {product?.image && (
            <span className="mt-1 flex items-center gap-2">
              <Image
                src={product.image}
                alt=""
                width={40}
                height={40}
                className="border-border size-10 rounded-md border object-cover"
              />
              <span className="text-muted-foreground text-xs">
                Foto actual. Sube otra para reemplazarla.
              </span>
            </span>
          )}
        </Field>
      </div>

      <Field label="Descripción">
        <Textarea
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="Masa artesanal, horneada a leña…"
          defaultValue={product?.description ?? undefined}
        />
      </Field>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Toggle
          name="allowNotes"
          label="Acepta notas del cliente"
          defaultChecked={product?.allowNotes ?? true}
        />
        <Toggle
          name="isVisible"
          label="Publicado en el menú"
          defaultChecked={product?.isVisible ?? true}
        />
      </div>

      <div className="border-border space-y-3 border-t pt-4">
        <Field
          label="Nombre del grupo de tamaños"
          hint='Ej. "Tamaño". Vacío si el producto no tiene tamaños.'
        >
          <Input
            name="variantGroupName"
            maxLength={40}
            placeholder="Tamaño"
            defaultValue={product?.variantGroupName ?? undefined}
            className="h-11 sm:max-w-xs"
          />
        </Field>

        <p className="text-muted-foreground text-xs">
          Hasta {MAX_VARIANT_OPTIONS} tamaños. El primero con nombre es el tamaño base: su
          diferencia de precio va en 0.
        </p>

        <div className="space-y-2">
          {Array.from({ length: MAX_VARIANT_OPTIONS }, (_, i) => (
            <OptionRow key={i} index={i} option={options[i]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionRow({ index, option }: { index: number; option?: OptionValues }) {
  return (
    <div className="border-border grid gap-2 rounded-xl border p-2.5 sm:grid-cols-[1fr_7rem_7rem_7rem_auto] sm:items-end sm:gap-2">
      <Field label={`Tamaño ${index + 1}`}>
        <Input
          name={`option_${index}_name`}
          maxLength={40}
          placeholder={index === 0 ? '24 cm' : 'Vacío = sin usar'}
          defaultValue={option?.name}
          className="h-11"
        />
      </Field>
      <Field label="Diferencia" hint={index === 0 ? '0 = base' : undefined}>
        <Input
          name={`option_${index}_priceDelta`}
          inputMode="numeric"
          placeholder="0"
          defaultValue={option ? formatMoney(option.priceDelta) : undefined}
          className="h-11"
        />
      </Field>
      <Field label="Agregado normal" hint="Opcional">
        <Input
          name={`option_${index}_extraPrice`}
          inputMode="numeric"
          placeholder="Catálogo"
          defaultValue={option?.extraPrice ? formatMoney(option.extraPrice) : undefined}
          className="h-11"
        />
      </Field>
      <Field label="Agregado premium" hint="Opcional">
        <Input
          name={`option_${index}_extraPremiumPrice`}
          inputMode="numeric"
          placeholder="Catálogo"
          defaultValue={
            option?.extraPremiumPrice ? formatMoney(option.extraPremiumPrice) : undefined
          }
          className="h-11"
        />
      </Field>
      <Toggle
        name={`option_${index}_available`}
        label="Disponible"
        defaultChecked={option ? option.isAvailable : true}
      />
    </div>
  );
}

/** Alta desde cero: mismos campos, sin valores previos. */
export function NewProductFields({ categories }: { categories: { id: string; name: string }[] }) {
  return <ProductFields categories={categories} />;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-muted-foreground/70 block text-[10px] tracking-widest uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="text-muted-foreground flex h-11 cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-primary focus-visible:ring-ring/50 size-4 rounded-[4px] focus-visible:ring-[3px] focus-visible:outline-none"
      />
      {label}
    </label>
  );
}
