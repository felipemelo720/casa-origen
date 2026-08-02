import { TagForm } from '@/features/admin/tag-form';

export const metadata = { title: 'Nueva etiqueta' };

export default function NewTagPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Nueva etiqueta</h1>
      <TagForm mode="create" />
    </div>
  );
}
