/**
 * Rutas del catálogo, en un solo lugar.
 *
 * La ficha la enlazan la tarjeta (cliente), el JSON-LD, el sitemap y las cards
 * de oferta (server). Con el string repetido, renombrar el segmento deja mitad
 * de los enlaces apuntando a un 404 que nadie mira porque la landing sigue
 * viéndose sana.
 */
export const PRODUCT_PATH_PREFIX = '/producto';
export const PROMO_PATH_PREFIX = '/promo';

export function productPath(slug: string): string {
  return `${PRODUCT_PATH_PREFIX}/${slug}`;
}

export function promoPath(slug: string): string {
  return `${PROMO_PATH_PREFIX}/${slug}`;
}
