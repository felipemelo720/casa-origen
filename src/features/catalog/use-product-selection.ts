'use client';

import { useMemo, useState } from 'react';

import { useCartStore } from '@/features/cart/cart-store';
import { notifyCartFull } from '@/features/cart/cart-limits';
import {
  initialSelection,
  selectionPrice,
  type ProductView,
  type ProductViewExtra,
  type ProductViewGroup,
  type ProductViewOption,
} from '@/features/catalog/product-view';
import { resolveExtraPrice, type SizeExtraPricing } from '@/lib/extra-price';

/**
 * Toda la lógica de armar una línea de carrito a partir de un producto.
 *
 * Vive acá y no en cada componente porque la tarjeta de la grilla y el panel de
 * la ficha muestran **el mismo número** con dos layouts distintos: duplicar el
 * cálculo garantiza que un día digan cosas diferentes. El precio que devuelve
 * es un espejo del que `pricing.service` va a cobrar, no la autoridad — al
 * carrito viajan ids y cantidades.
 */
export function useProductSelection(product: ProductView) {
  const addLine = useCartStore((state) => state.addLine);

  const [selection, setSelection] = useState<Record<string, string>>(() =>
    initialSelection(product.groups),
  );
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  /** Opciones elegidas, en el orden de los grupos: el mismo que se manda al server. */
  const selectedOptions = useMemo(() => {
    const picked: { group: ProductViewGroup; option: ProductViewOption }[] = [];
    for (const group of product.groups) {
      const optionId = selection[group.id];
      const option = group.options.find((candidate) => candidate.id === optionId);
      if (option) picked.push({ group, option });
    }
    return picked;
  }, [product.groups, selection]);

  /**
   * Qué opción tarifa los agregados. Mismo criterio que `pricing.service`: gana
   * la **última** opción seleccionada que traiga `extraPrice`, así una bebida
   * sin tramo no le pisa el precio a la pizza que sí lo tiene.
   */
  const sizePricing = useMemo<SizeExtraPricing | null>(
    () =>
      selectedOptions.reduce<SizeExtraPricing | null>(
        (size, { option }) =>
          option.extraPrice != null
            ? { extraPrice: option.extraPrice, extraPremiumPrice: option.extraPremiumPrice }
            : size,
        null,
      ),
    [selectedOptions],
  );

  function extraUnitPrice(entry: ProductViewExtra): number {
    return resolveExtraPrice({
      size: sizePricing,
      isPremium: entry.isPremium,
      priceOverride: entry.priceOverride,
      catalogPrice: entry.price,
    });
  }

  const chosenExtras = product.extras.filter((entry) => selectedExtraIds.includes(entry.extraId));
  const extrasTotal = chosenExtras.reduce((sum, entry) => sum + extraUnitPrice(entry), 0);

  const basePrice = product.offerPrice ?? product.price;
  const hasOffer = product.offerPrice !== null && product.offerPrice < product.price;

  const options = selectedOptions.map(({ option }) => option);
  /** Lo que cuesta una unidad tal como está configurada ahora. */
  const unitPrice = selectionPrice(basePrice, options) + extrasTotal;
  /** Lo mismo a precio de lista, para el «Antes $X» tachado. */
  const regularUnitPrice = selectionPrice(product.price, options) + extrasTotal;

  /**
   * Grupos requeridos todavía sin resolver. Es la misma guarda que
   * `pricing.service` aplica al cobrar: sin esto el botón agregaría una línea
   * que el checkout rechaza recién al final del embudo.
   */
  const missingGroups = product.groups.filter(
    (group) => group.isRequired && group.options.length > 0 && !selection[group.id],
  );

  const canAdd = product.isAvailable && missingGroups.length === 0;

  function selectOption(groupId: string, optionId: string) {
    setSelection((current) => ({ ...current, [groupId]: optionId }));
  }

  function toggleExtra(extraId: string) {
    setSelectedExtraIds((current) =>
      current.includes(extraId) ? current.filter((id) => id !== extraId) : [...current, extraId],
    );
  }

  function addToCart() {
    if (!canAdd) return;

    const added = addLine({
      productId: product.id,
      name: product.name,
      image: product.image,
      basePrice,
      quantity,
      variants: selectedOptions.map(({ group, option }) => ({
        groupId: group.id,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta,
        extraPrice: option.extraPrice,
        extraPremiumPrice: option.extraPremiumPrice,
      })),
      extras: chosenExtras.map((entry) => ({
        extraId: entry.extraId,
        name: entry.name,
        unitPrice: extraUnitPrice(entry),
        quantity: 1,
      })),
      removedIngredientIds: [],
      removedIngredientNames: [],
    });

    // El carrito tiene el mismo tope que el server. Se avisa acá en vez de
    // deshabilitar el botón: el tope es un caso extremo y un cartel bajo cada
    // tarjeta de la grilla sería ruido permanente para nadie.
    if (!added) {
      notifyCartFull();
      return;
    }

    // El control se reusa para el siguiente pedido del mismo producto; dejar los
    // agregados marcados cobraría la segunda pizza como la primera.
    setSelectedExtraIds([]);
    setQuantity(1);
  }

  return {
    selection,
    selectedOptions,
    selectOption,
    selectedExtraIds,
    toggleExtra,
    extraUnitPrice,
    chosenExtras,
    quantity,
    setQuantity,
    basePrice,
    hasOffer,
    unitPrice,
    regularUnitPrice,
    missingGroups,
    canAdd,
    addToCart,
  };
}
