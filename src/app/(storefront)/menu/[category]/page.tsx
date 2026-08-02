import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { MenuView } from '@/features/catalog/menu-view';
import { categoryRepository } from '@/server/repositories/category.repository';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const found = await categoryRepository.findBySlug(category);
  return { title: found?.name ?? 'Menú' };
}

export default async function MenuCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ category }, { q }] = await Promise.all([params, searchParams]);
  const found = await categoryRepository.findBySlug(category);
  if (!found) notFound();

  return <MenuView categorySlug={category} search={q} />;
}
