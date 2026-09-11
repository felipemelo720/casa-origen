import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

import { productRepository } from '@/server/repositories/product.repository';
import { ProductRow } from '@/features/admin/product-row';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Productos — Admin — Casa Origen' };
export const dynamic = 'force-dynamic';

/**
 * CRUD de productos. Aparte del dashboard de `/admin`: una lista completa con
 * alta/edición/baja no cabe en la única pantalla que se mira a diario sin
 * empujar horarios y cupones fuera del fold. La autenticación la resuelve el
 * middleware de `/admin/*`, no hace falta repetirla acá.
 */
export default async function AdminProductsPage() {
  const products = await productRepository.findAllForAdmin();

  const categories = new Map<string, { categoryName: string; products: typeof products }>();
  for (const product of products) {
    const bucket = categories.get(product.category.id) ?? {
      categoryName: product.category.name,
      products: [],
    };
    bucket.products.push(product);
    categories.set(product.category.id, bucket);
  }

  return (
    <main className="min-h-dvh pb-12">
      <header className="border-border bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="size-11">
              <Link href="/admin" aria-label="Volver al panel">
                <ArrowLeft aria-hidden="true" />
              </Link>
            </Button>
            <h1 className="font-display text-xl font-bold">Productos</h1>
          </div>
          <Button asChild size="sm" className="h-11">
            <Link href="/admin/productos/nuevo">
              <Plus aria-hidden="true" />
              Nuevo
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {products.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-xl border border-dashed p-6 text-center text-sm">
            Todavía no hay productos. Crea el primero.
          </p>
        ) : (
          [...categories.values()].map(({ categoryName, products: categoryProducts }) => (
            <div key={categoryName} className="space-y-2">
              <p className="text-muted-foreground/70 text-[10px] tracking-widest uppercase">
                {categoryName}
              </p>
              <div className="border-border bg-card overflow-hidden rounded-xl border">
                {categoryProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={{
                      id: product.id,
                      name: product.name,
                      image: product.image,
                      price: product.price,
                      offerPrice: product.offerPrice,
                      isActive: product.isActive,
                      categoryName,
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
