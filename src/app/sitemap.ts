import type { MetadataRoute } from 'next';

import { publicEnv } from '@/config/public-env';
import { categoryRepository } from '@/server/repositories/category.repository';
import { productRepository } from '@/server/repositories/product.repository';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL;

  const [categories, { items: products }] = await Promise.all([
    categoryRepository.findMenuTree(),
    productRepository.findMany({ take: 200 }),
  ]);

  function flattenSlugs(nodes: Awaited<ReturnType<typeof categoryRepository.findMenuTree>>): string[] {
    return nodes.flatMap((node) => [node.slug, ...flattenSlugs(node.children)]);
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/menu`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/pedido`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = flattenSlugs(categories).map((slug) => ({
    url: `${baseUrl}/menu/${slug}`,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/producto/${product.slug}`,
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
