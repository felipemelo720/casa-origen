import { publicEnv } from '@/config/public-env';
import type { ScheduleDay } from '@/server/services/schedule.service';

type Props = {
  name: string;
  description: string | null;
  image: string | null;
  phone: string | null;
  address: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  schedule: ScheduleDay[];
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
  address,
  instagramUrl,
  facebookUrl,
  schedule,
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
    hasMenu: `${url}/#menu`,
    ...(description ? { description } : {}),
    ...(image ? { image: absoluteUrl(image, url) } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: address,
            addressCountry: 'CL',
          },
        }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
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
