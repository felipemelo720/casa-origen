import { notFound } from 'next/navigation';

import { extraRepository } from '@/server/repositories/catalog-support.repository';
import { ExtraForm } from '@/features/admin/extra-form';

export const metadata = { title: 'Editar extra' };

export default async function EditExtraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const extra = await extraRepository.findById(id);
  if (!extra) notFound();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Editar extra</h1>
      <ExtraForm
        mode="edit"
        extraId={extra.id}
        defaultValues={{
          name: extra.name,
          slug: extra.slug,
          description: extra.description ?? '',
          price: extra.price,
          isActive: extra.isActive,
          sortOrder: extra.sortOrder,
        }}
      />
    </div>
  );
}
