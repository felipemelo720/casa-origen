import type { Metadata } from 'next';

import { MenuView } from '@/features/catalog/menu-view';

export const metadata: Metadata = { title: 'Menú' };
export const revalidate = 60;

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <MenuView search={q} />;
}
