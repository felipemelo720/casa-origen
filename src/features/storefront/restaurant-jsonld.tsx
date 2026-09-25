import { publicEnv } from '@/config/public-env';
import type { ScheduleDay } from '@/server/services/schedule.service';

type Props = {
  name: string;
  description: string | null;
  image: string | null;
  phone: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  schedule: ScheduleDay[];
  /** Nombres de las zonas de despacho activas. */
  areaServed: string[];
  menu: MenuSection[];
};

/** View model estrecho de la carta: el JSON-LD no necesita el producto entero. */
export type MenuSection = {
  name: string;
  items: { name: string; description: string | null; path: string; priceFrom: number }[];
};

/** `Date#getDay` index to the day names schema.org expects. */
const SCHEMA_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Structured data for the storefront. Nothing renders, but it is what lets a
 * search result show the hours, phone and menu link instead of a bare title.
 */
export function RestaurantJsonLd({
  name,
  description,
  image,
  phone,
  instagramUrl,
  facebookUrl,
  schedule,
  areaServed,
  menu,
}: Props) {
  const url = publicEnv.NEXT_PUBLIC_APP_URL;
  const sameAs = [instagramUrl, facebookUrl].filter((link): link is string => Boolean(link));

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name,
    url,
    servesCuisine: 'Pizza',
    priceRange: '$$',
    acceptsReservations: false,
    // La carta completa, para que «pizza Paine precio» encuentre precios reales.
    // `AggregateOffer.lowPrice` y no `Offer.price`: el precio de entrada es el
    // del tamaño más chico, y declararlo como precio único mentiría con la 32 cm.
    hasMenu: {
      '@type': 'Menu',
      url: `${url}/#menu`,
      hasMenuSection: menu.map((section) => ({
        '@type': 'MenuSection',
        name: section.name,
        hasMenuItem: section.items.map((item) => ({
          '@type': 'MenuItem',
          name: item.name,
          url: absoluteUrl(item.path, url),
          ...(item.description ? { description: item.description } : {}),
          offers: {
            '@type': 'AggregateOffer',
            lowPrice: item.priceFrom,
            priceCurrency: 'CLP',
          },
        })),
      })),
    },
    ...(description ? { description } : {}),
    ...(image ? { image: absoluteUrl(image, url) } : {}),
    ...(phone ? { telephone: phone } : {}),
    // Sin calle a propósito: el local no atiende público y la dirección no se
    // publica. Google lo trata como negocio de área de servicio (ver areaServed).
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Paine',
      addressRegion: 'Región Metropolitana',
      addressCountry: 'CL',
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
    // SEO local: «pizza Champa», «pizza Viluco». La zona rural guarda sus
    // localidades en un solo `name` separado por comas; cada una va aparte.
    areaServed: [
      { '@type': 'City', name: 'Paine' },
      ...areaServed
        .flatMap((zone) => zone.split(', '))
        .map((place) => ({ '@type': 'Place', name: place })),
    ],
    // Un `OpeningHoursSpecification` por turno, no por día: schema.org no tiene
    // forma de expresar un corte al mediodía dentro de una sola franja, y
    // declarar 12:30–22:00 le diría a Google que a las 16:00 estamos abiertos.
    openingHoursSpecification: schedule
      .filter((day) => !day.isClosed)
      .flatMap((day) =>
        day.slots.map((slot) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: `https://schema.org/${SCHEMA_DAYS[day.dayOfWeek] ?? 'Monday'}`,
          opens: slot.opensAt,
          closes: slot.closesAt,
        })),
      ),
  };

  return (
    <script
      type="application/ld+json"
      // Escaped so a `</script>` inside any settings field cannot close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

function absoluteUrl(path: string, base: string): string {
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
