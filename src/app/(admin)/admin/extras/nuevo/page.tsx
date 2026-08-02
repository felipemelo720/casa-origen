import { ExtraForm } from '@/features/admin/extra-form';

export const metadata = { title: 'Nuevo extra' };

export default function NewExtraPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Nuevo extra</h1>
      <ExtraForm mode="create" />
    </div>
  );
}
