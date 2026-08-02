import { SearchIcon } from 'lucide-react';

import { CategoryNav } from '@/features/catalog/category-nav';
import { ProductCard } from '@/features/catalog/product-card';
import { Input } from '@/components/ui/input';
import { categoryRepository } from '@/server/repositories/category.repository';
import { productRepository } from '@/server/repositories/product.repository';

export async function MenuView({
  categorySlug,
  search,
}: {
  categorySlug?: string;
  search?: string;
}) {
  const [categories, { items: products }] = await Promise.all([
    categoryRepository.findMenuTree(),
    productRepository.findMany({ categorySlug, search, take: 60 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-4">
        <h1 className="font-display text-3xl font-bold">Menú</h1>
        <form action="/menu" method="get" className="relative max-w-md">
          <SearchIcon className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Buscar en el menú…"
            className="pl-9"
          />
        </form>
        <CategoryNav categories={categories} />
      </div>

      {products.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          No encontramos productos con esos criterios.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
