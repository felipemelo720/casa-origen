'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { ProductCard as ProductCardData } from '@/server/repositories/product.repository';
import { useCartStore } from '@/features/cart/cart-store';

export function ProductCard({ product }: { product: ProductCardData }) {
  const addLine = useCartStore((state) => state.addLine);
  const effectivePrice = product.offerPrice ?? product.price;
  const hasOffer = product.offerPrice !== null && product.offerPrice < product.price;
  const isUnavailable = product.availability !== 'AVAILABLE';

  function handleQuickAdd() {
    addLine({
      productId: product.id,
      name: product.name,
      image: product.image,
      basePrice: effectivePrice,
      quantity: 1,
      variants: [],
      extras: [],
      removedIngredientIds: [],
      removedIngredientNames: [],
    });
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group border-border bg-card relative flex flex-col overflow-hidden rounded-2xl border"
    >
      <Link href={`/producto/${product.slug}`} className="block">
        <div className="bg-muted relative aspect-[4/3] overflow-hidden">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className={cn(
                'object-cover transition-transform duration-500 group-hover:scale-105',
                isUnavailable && 'grayscale',
              )}
            />
          ) : null}

          {isUnavailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Badge variant="secondary">Agotado</Badge>
            </div>
          )}

          {product.tags.length > 0 && (
            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
              {product.tags.slice(0, 2).map(({ tag }) => (
                <Badge
                  key={tag.id}
                  className="border-none text-[10px]"
                  style={{ backgroundColor: tag.color, color: 'white' }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/producto/${product.slug}`}>
          <h3 className="font-display line-clamp-1 text-base font-semibold">{product.name}</h3>
        </Link>
        {product.shortDescription && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{product.shortDescription}</p>
        )}

        <div className="text-muted-foreground mt-auto flex items-center gap-1 text-xs">
          <Clock className="size-3.5" />
          {product.prepMinutes} min
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-primary text-lg font-bold">{formatMoney(effectivePrice)}</span>
            {hasOffer && (
              <span className="text-muted-foreground text-sm line-through">
                {formatMoney(product.price)}
              </span>
            )}
          </div>
          <Button
            size="icon-sm"
            disabled={isUnavailable}
            onClick={handleQuickAdd}
            aria-label={`Agregar ${product.name} al carrito`}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
