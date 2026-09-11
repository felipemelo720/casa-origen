import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { categoryRepository } from '@/server/repositories/category.repository';
import { createProductAction } from '@/server/actions/product.actions';
import { AdminForm, AdminSubmit } from '@/features/admin/admin-form';
import { NewProductFields } from '@/features/admin/product-fields';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Nuevo producto — Admin — Casa Origen' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const categories = await categoryRepository.findAllActive();

  return (
    <main className="min-h-dvh pb-12">
      <header className="border-border bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4">
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link href="/admin/productos" aria-label="Volver a productos">
              <ArrowLeft aria-hidden="true" />
            </Link>
          </Button>
          <h1 className="font-display text-xl font-bold">Producto nuevo</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <AdminForm action={createProductAction} className="space-y-5">
          <NewProductFields categories={categories} />
          <AdminSubmit className="h-11 w-full">Crear producto</AdminSubmit>
        </AdminForm>
      </div>
    </main>
  );
}
