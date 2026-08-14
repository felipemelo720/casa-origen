import { publicEnv } from '@/config/public-env';
import { productPath } from '@/features/catalog/product-path';
import { priceRange, type ProductDetailView } from '@/features/catalog/product-view';
import { currencyCode, currencyDecimals } from '@/lib/money';

/**
 * `Product` + `BreadcrumbList` de la ficha.
 *
 * Es la mitad de la razón de que estas páginas existan: sin datos estructurados
 * un resultado de búsqueda es un título y una URL; con ellos puede mostrar
 * precio y disponibilidad. Un producto con tamaños sale como `AggregateOffer`
 * (rango real), uno sin tamaños como `Offer` (cifra exacta).
 */
export function ProductJsonLd({
  product,
  restaurantName,
}: {
  product: ProductDetailView;
  restaurantName: string;
}) {
  const site = publicEnv.NEXT_PUBLIC_APP_URL;
  const url = `${site}${productPath(product.slug)}`;
  const { min, max } = priceRange(product);

  const availability = product.isAvailable
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';

  const offer =
    min === max
      ? {
          '@type': 'Offer',
          price: toSchemaPrice(min),
          priceCurrency: currencyCode,
          availability,
          url,
        }
      : {
          '@type': 'AggregateOffer',
          lowPrice: toSchemaPrice(min),
          highPrice: toSchemaPrice(max),
          offerCount: product.groups.reduce(
            (count, group) => count + (group.isRequired ? group.options.length : 0),
            0,
          ),
          priceCurrency: currencyCode,
          availability,
          url,
        };

  const images = product.images.length > 0 ? product.images.map((image) => image.url) : [];
  if (product.image && !images.includes(product.image)) images.unshift(product.image);

  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      url,
      category: product.category.name,
      ...(product.description || product.shortDescription
        ? { description: product.description ?? product.shortDescription }
        : {}),
      ...(images.length > 0 ? { image: images.map((image) => absoluteUrl(image, site)) } : {}),
      brand: { '@type': 'Brand', name: restaurantName },
      offers: offer,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Carta', item: `${site}/#menu` },
        { '@type': 'ListItem', position: 2, name: product.category.name, item: `${site}/#menu` },
        { '@type': 'ListItem', position: 3, name: product.name, item: url },
      ],
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Mismo escape que `RestaurantJsonLd`: un `</script>` guardado desde el
      // admin en la descripción de un producto no puede cerrar el tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

/** Los montos del sistema son enteros en la unidad menor; schema.org quiere decimal. */
function toSchemaPrice(amount: number): string {
  return (amount / 10 ** currencyDecimals).toFixed(currencyDecimals);
}

function absoluteUrl(path: string, base: string): string {
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
