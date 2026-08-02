import { notFound } from 'next/navigation';

import { tagRepository } from '@/server/repositories/catalog-support.repository';
import { TagForm } from '@/features/admin/tag-form';

export const metadata = { title: 'Editar etiqueta' };

export default async function EditTagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tag = await tagRepository.findById(id);
  if (!tag) notFound();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Editar etiqueta</h1>
      <TagForm
        mode="edit"
        tagId={tag.id}
        defaultValues={{ name: tag.name, slug: tag.slug, color: tag.color, isActive: tag.isActive, sortOrder: tag.sortOrder }}
      />
    </div>
  );
}
