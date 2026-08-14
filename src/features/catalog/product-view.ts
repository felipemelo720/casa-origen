import type { ProductDetail } from '@/server/repositories/product.repository';

/**
 * View models del catálogo.
 *
 * Existen porque `ProductCard` y el panel de compra de la ficha son client
 * components: pasarles la fila de Prisma serializa el producto entero al
 * payload RSC (contadores, timestamps, `sku`, ids de relación) y arrastra el
 * tipo de Prisma al bundle del cliente. Acá se recorta a lo que la UI dibuja y
 * a lo que el carrito necesita mandar de vuelta — ids y cantidades, nunca
 * precios que el server no vaya a recalcular.
 *
 * Módulo puro, sin `server-only`: lo llama el server para mapear y lo importan
 * los componentes cliente sólo por el tipo.
 */

export type ProductViewOption = {
  id: string;
  name: string;
  priceDelta: number;
  extraPrice: number | null;
  extraPremiumPrice: number | null;
  isAvailable: boolean;
};

export type ProductViewGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  options: ProductViewOption[];
};

export type ProductViewExtra = {
  extraId: string;
  name: string;
  /** Precio de catálogo del agregado; sólo se usa si el tamaño no tarifa. */
  price: number;
  priceOverride: number | null;
  isPremium: boolean;
};

export type ProductViewTag = { id: string; name: string; color: string };

/** Lo mínimo que necesita una tarjeta de la grilla. */
export type ProductView = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  image: string | null;
  price: number;
  offerPrice: number | null;
  isAvailable: boolean;
  tags: ProductViewTag[];
  groups: ProductViewGroup[];
  extras: ProductViewExtra[];
};

export type ProductViewImage = { id: string; url: string; alt: string | null };

export type ProductViewIngredient = { id: string; name: string; isAllergen: boolean };

/** La ficha: todo lo de la tarjeta más lo que sólo cabe en una página propia. */
export type ProductDetailView = ProductView & {
  description: string | null;
  images: ProductViewImage[];
  ingredients: ProductViewIngredient[];
  prepMinutes: number;
  category: { id: string; name: string; slug: string };
};

/** Recorta la fila de Prisma a lo que la tarjeta dibuja. */
export function toProductView(product: ProductDetail): ProductView {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    image: product.image,
    price: product.price,
    offerPrice: product.offerPrice,
    isAvailable: product.availability === 'AVAILABLE',
    tags: product.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color })),
    groups: product.variantGroups.map((group) => ({
      id: group.id,
      name: group.name,
      isRequired: group.isRequired,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
        extraPrice: option.extraPrice,
        extraPremiumPrice: option.extraPremiumPrice,
        isAvailable: option.isAvailable,
      })),
    })),
    // Un agregado desactivado no se filtra en la tarjeta por casualidad: es la
    // misma regla que aplica `pricing.service` al cobrarlo.
    extras: product.extras
      .filter((entry) => entry.extra.isActive)
      .map((entry) => ({
        extraId: entry.extraId,
        name: entry.extra.name,
        price: entry.extra.price,
        priceOverride: entry.priceOverride,
        isPremium: entry.extra.isPremium,
      })),
  };
}

/** Lo mismo, más la descripción larga, la galería y los ingredientes. */
export function toProductDetailView(product: ProductDetail): ProductDetailView {
  return {
    ...toProductView(product),
    description: product.description,
    images: product.images.map((image) => ({ id: image.id, url: image.url, alt: image.alt })),
    ingredients: product.ingredients.map(({ ingredient }) => ({
      id: ingredient.id,
      name: ingredient.name,
      isAllergen: ingredient.isAllergen,
    })),
    prepMinutes: product.prepMinutes,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
  };
}

/**
 * Tamaño más grande que la cocina puede hacer: el mayor `priceDelta` entre las
 * opciones disponibles. Cae a la primera disponible cuando todos los deltas son
 * iguales, y a nada cuando el grupo está agotado.
 */
export function largestAvailableOption(
  options: readonly ProductViewOption[] | undefined,
): ProductViewOption | undefined {
  if (!options) return undefined;

  let best: ProductViewOption | undefined;
  for (const option of options) {
    if (!option.isAvailable) continue;
    if (!best || option.priceDelta > best.priceDelta) best = option;
  }
  return best;
}

/**
 * Con qué opción abre cada grupo.
 *
 * Un grupo cuyas opciones **cuestan distinto** es una escalera de tamaño: se
 * abre en la más grande disponible, así el botón sugiere la familiar y bajar de
 * tamaño cuesta un tap. Un grupo cuyas opciones cuestan **lo mismo** es una
 * elección de sabor (el Combo Individual: «Elige tu pizza», «Elige tu bebida»),
 * y ahí preseleccionar sería elegir por el cliente: queda vacío.
 *
 * Deliberadamente no mira `isDefault`, que el seed pone en el tamaño chico.
 */
export function initialSelection(groups: readonly ProductViewGroup[]): Record<string, string> {
  const selection: Record<string, string> = {};
  for (const group of groups) {
    const prices = new Set(group.options.map((option) => option.priceDelta));
    if (prices.size < 2) continue;
    const largest = largestAvailableOption(group.options);
    if (largest) selection[group.id] = largest.id;
  }
  return selection;
}

/**
 * Precio del producto suelto **sin** agregados, para la opción elegida en cada
 * grupo. `base` decide si el ancla es el precio de oferta o el de lista.
 */
export function selectionPrice(
  base: number,
  selectedOptions: readonly ProductViewOption[],
): number {
  return selectedOptions.reduce((total, option) => total + option.priceDelta, base);
}

/** Rango de precios de un producto, para la grilla y para el JSON-LD. */
export function priceRange(product: ProductView): { min: number; max: number } {
  const base = product.offerPrice ?? product.price;
  const deltas = product.groups
    .filter((group) => group.isRequired && group.options.length > 0)
    .map((group) => group.options.map((option) => option.priceDelta));

  // Un producto sin grupos requeridos cuesta su precio base y nada más.
  const min = deltas.reduce((total, options) => total + Math.min(...options), base);
  const max = deltas.reduce((total, options) => total + Math.max(...options), base);
  return { min, max };
}
