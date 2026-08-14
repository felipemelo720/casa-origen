import type { MetadataRoute } from 'next';

import { publicEnv } from '@/config/public-env';
import { productPath, promoPath } from '@/features/catalog/product-path';
import { productRepository } from '@/server/repositories/product.repository';
import { promotionRepository } from '@/server/repositories/promotion.repository';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL;

  const [products, featuredBundle] = await Promise.all([
    productRepository.findAllSlugs(),
    promotionRepository.findFeaturedBundle(),
  ]);

  return [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    ...(featuredBundle
      ? [
          {
            url: `${baseUrl}${promoPath(featuredBundle.slug)}`,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
          },
        ]
      : []),
    // Sólo las fichas visibles. Un producto fuera de la carta (el combo) tiene
    // página propia para poder compartirse, pero anunciarlo al crawler lo
    // pondría a competir con la carta misma; su `metadata` va `noindex`.
    ...products
      .filter((product) => product.isVisible)
      .map((product) => ({
        url: `${baseUrl}${productPath(product.slug)}`,
        lastModified: product.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
  ];
}
