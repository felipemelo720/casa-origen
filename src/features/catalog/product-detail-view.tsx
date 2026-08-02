'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Clock, Minus, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/features/cart/cart-store';
import type { ProductDetail } from '@/server/repositories/product.repository';

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const addLine = useCartStore((state) => state.addLine);
  const open = useCartStore((state) => state.open);

  const basePrice = product.offerPrice ?? product.price;
  const hasOffer = product.offerPrice !== null && product.offerPrice < product.price;
  const isUnavailable = product.availability !== 'AVAILABLE';

  const gallery = product.images.length > 0 ? product.images : null;
  const [activeImage, setActiveImage] = useState(0);

  const [variantSelections, setVariantSelections] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const group of product.variantGroups) {
      const defaults = group.options.filter((o) => o.isDefault && o.isAvailable).map((o) => o.id);
      initial[group.id] = group.selectionType === 'SINGLE' ? defaults.slice(0, 1) : defaults;
    }
    return initial;
  });

  const [extraQuantities, setExtraQuantities] = useState<Record<string, number>>({});
  const [removedIngredientIds, setRemovedIngredientIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  function toggleSingleVariant(groupId: string, optionId: string) {
    setVariantSelections((prev) => ({ ...prev, [groupId]: [optionId] }));
  }

  function toggleMultiVariant(groupId: string, optionId: string, max: number) {
    setVariantSelections((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= max) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  function setExtraQuantity(extraId: string, quantity: number, max: number) {
    setExtraQuantities((prev) => ({ ...prev, [extraId]: Math.max(0, Math.min(quantity, max)) }));
  }

  function toggleIngredient(ingredientId: string) {
    setRemovedIngredientIds((prev) =>
      prev.includes(ingredientId) ? prev.filter((id) => id !== ingredientId) : [...prev, ingredientId],
    );
  }

  const missingRequiredGroups = useMemo(
    () =>
      product.variantGroups.filter((group) => {
        if (!group.isRequired) return false;
        const count = (variantSelections[group.id] ?? []).length;
        return count < group.minSelect || count > group.maxSelect;
      }),
    [product.variantGroups, variantSelections],
  );

  const variantsDelta = useMemo(() => {
    let total = 0;
    for (const group of product.variantGroups) {
      for (const optionId of variantSelections[group.id] ?? []) {
        const option = group.options.find((o) => o.id === optionId);
        if (option) total += option.priceDelta;
      }
    }
    return total;
  }, [product.variantGroups, variantSelections]);

  const extrasTotal = useMemo(() => {
    let total = 0;
    for (const entry of product.extras) {
      const qty = extraQuantities[entry.extraId] ?? 0;
      if (qty > 0) total += (entry.priceOverride ?? entry.extra.price) * qty;
    }
    return total;
  }, [product.extras, extraQuantities]);

  const unitPrice = basePrice + variantsDelta;
  const totalPrice = unitPrice * quantity + extrasTotal * quantity;
  const canAdd = !isUnavailable && missingRequiredGroups.length === 0;

  function handleAddToCart() {
    if (!canAdd) return;

    const variants = product.variantGroups.flatMap((group) =>
      (variantSelections[group.id] ?? []).flatMap((optionId) => {
        const option = group.options.find((o) => o.id === optionId);
        return option
          ? [{ groupId: group.id, optionId: option.id, optionName: option.name, priceDelta: option.priceDelta }]
          : [];
      }),
    );

    const extras = product.extras.flatMap((entry) => {
      const qty = extraQuantities[entry.extraId] ?? 0;
      if (qty <= 0) return [];
      return [
        {
          extraId: entry.extraId,
          name: entry.extra.name,
          unitPrice: entry.priceOverride ?? entry.extra.price,
          quantity: qty,
        },
      ];
    });

    const removedIngredientNames = product.ingredients
      .filter((pi) => removedIngredientIds.includes(pi.ingredientId))
      .map((pi) => pi.ingredient.name);

    addLine({
      productId: product.id,
      name: product.name,
      image: product.image,
      basePrice,
      quantity,
      variants,
      extras,
      removedIngredientIds,
      removedIngredientNames,
      notes: notes.trim() || undefined,
    });

    open();
    router.push('/menu');
  }

  const removableIngredients = product.ingredients.filter((pi) => pi.isRemovable);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="bg-muted relative aspect-square overflow-hidden rounded-2xl">
            {(gallery?.[activeImage]?.url ?? product.image) ? (
              <Image
                src={gallery?.[activeImage]?.url ?? product.image ?? ''}
                alt={gallery?.[activeImage]?.alt ?? product.name}
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className={cn('object-cover', isUnavailable && 'grayscale')}
              />
            ) : null}
            {isUnavailable && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Badge variant="secondary">Agotado</Badge>
              </div>
            )}
          </div>
          {gallery && gallery.length > 1 && (
            <div className="flex gap-2">
              {gallery.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={cn(
                    'bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg border-2',
                    index === activeImage ? 'border-primary' : 'border-transparent',
                  )}
                >
                  <Image src={image.url} alt={image.alt ?? product.name} fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {product.tags.map(({ tag }) => (
                  <Badge key={tag.id} className="border-none text-[10px]" style={{ backgroundColor: tag.color, color: 'white' }}>
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
            <h1 className="font-display text-3xl font-bold">{product.name}</h1>
            {product.description && <p className="text-muted-foreground">{product.description}</p>}
            <div className="text-muted-foreground flex items-center gap-1 text-sm">
              <Clock className="size-4" />
              {product.prepMinutes} min
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-primary text-2xl font-bold">{formatMoney(basePrice)}</span>
              {hasOffer && <span className="text-muted-foreground line-through">{formatMoney(product.price)}</span>}
            </div>
          </div>

          {product.variantGroups.map((group) => (
            <div key={group.id} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <Label className="text-base font-semibold">
                  {group.name}
                  {group.isRequired && <span className="text-destructive"> *</span>}
                </Label>
                {group.selectionType === 'MULTIPLE' && (
                  <span className="text-muted-foreground text-xs">
                    Elige hasta {group.maxSelect}
                  </span>
                )}
              </div>

              {group.selectionType === 'SINGLE' ? (
                <RadioGroup
                  value={variantSelections[group.id]?.[0] ?? ''}
                  onValueChange={(value) => toggleSingleVariant(group.id, value)}
                >
                  {group.options.map((option) => (
                    <label
                      key={option.id}
                      className={cn(
                        'border-border flex items-center justify-between gap-2 rounded-lg border px-3 py-2',
                        !option.isAvailable && 'opacity-50',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <RadioGroupItem value={option.id} disabled={!option.isAvailable} />
                        {option.name}
                      </span>
                      {option.priceDelta !== 0 && (
                        <span className="text-muted-foreground text-sm">
                          {option.priceDelta > 0 ? '+' : ''}
                          {formatMoney(option.priceDelta)}
                        </span>
                      )}
                    </label>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  {group.options.map((option) => {
                    const checked = (variantSelections[group.id] ?? []).includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          'border-border flex items-center justify-between gap-2 rounded-lg border px-3 py-2',
                          !option.isAvailable && 'opacity-50',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Checkbox
                            checked={checked}
                            disabled={!option.isAvailable}
                            onCheckedChange={() => toggleMultiVariant(group.id, option.id, group.maxSelect)}
                          />
                          {option.name}
                        </span>
                        {option.priceDelta !== 0 && (
                          <span className="text-muted-foreground text-sm">
                            {option.priceDelta > 0 ? '+' : ''}
                            {formatMoney(option.priceDelta)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {product.extras.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Extras</Label>
              <div className="space-y-2">
                {product.extras.map((entry) => {
                  const qty = extraQuantities[entry.extraId] ?? 0;
                  const price = entry.priceOverride ?? entry.extra.price;
                  return (
                    <div key={entry.extraId} className="border-border flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{entry.extra.name}</p>
                        <p className="text-muted-foreground text-xs">+{formatMoney(price)} c/u</p>
                      </div>
                      <div className="border-border flex items-center rounded-md border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setExtraQuantity(entry.extraId, qty - 1, entry.maxQuantity)}
                          aria-label={`Quitar ${entry.extra.name}`}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setExtraQuantity(entry.extraId, qty + 1, entry.maxQuantity)}
                          aria-label={`Agregar ${entry.extra.name}`}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {removableIngredients.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Ingredientes</Label>
              <div className="flex flex-wrap gap-3">
                {removableIngredients.map((pi) => (
                  <label key={pi.ingredientId} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={removedIngredientIds.includes(pi.ingredientId)}
                      onCheckedChange={() => toggleIngredient(pi.ingredientId)}
                    />
                    Sin {pi.ingredient.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {product.allowNotes && (
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base font-semibold">
                Observaciones
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                placeholder="Ej: sin cebolla, cortar en trozos…"
              />
            </div>
          )}

          <Separator />

          <div className="flex items-center gap-4">
            <div className="border-border flex items-center rounded-md border">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Disminuir cantidad"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-8 text-center font-medium tabular-nums">{quantity}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                aria-label="Aumentar cantidad"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <Button size="lg" className="flex-1" disabled={!canAdd} onClick={handleAddToCart}>
              {isUnavailable ? 'No disponible' : `Agregar · ${formatMoney(totalPrice)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
