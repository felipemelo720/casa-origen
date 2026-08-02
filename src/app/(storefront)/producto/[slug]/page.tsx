import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { productRepository } from '@/server/repositories/product.repository';
import { ProductDetailView } from '@/features/catalog/product-detail-view';

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await productRepository.findBySlug(slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    openGraph: product.image ? { images: [{ url: product.image }] } : undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await productRepository.findBySlug(slug);

  if (!product || !product.isActive || !product.isVisible) notFound();

  return <ProductDetailView product={product} />;
}
