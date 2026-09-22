import Link from 'next/link';
import { Plus } from 'lucide-react';

import { productRepository } from '@/server/repositories/product.repository';
import { AdminPageHeader } from '@/features/admin/admin-page-header';
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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader
        title="Productos"
        description="Crear, editar y dar de baja. Agotar y destacar se hace desde Hoy."
        actions={
          <Button asChild className="h-11">
            <Link href="/admin/productos/nuevo">
              <Plus aria-hidden="true" />
              Nuevo
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
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
    </div>
  );
}
