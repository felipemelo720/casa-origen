'use client';

import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { ProductDetail } from '@/server/repositories/product.repository';
import { useCartStore } from '@/features/cart/cart-store';

export function ProductCard({ product }: { product: ProductDetail }) {
  const addLine = useCartStore((state) => state.addLine);
  const isUnavailable = product.availability !== 'AVAILABLE';
  const sizeGroup = product.variantGroups[0];

  const [selectedOptionId, setSelectedOptionId] = useState(
    sizeGroup?.options.find((option) => option.isDefault)?.id ?? sizeGroup?.options[0]?.id,
  );
  const selectedOption = sizeGroup?.options.find((option) => option.id === selectedOptionId);

  const basePrice = product.offerPrice ?? product.price;
  const hasOffer = product.offerPrice !== null && product.offerPrice < product.price;
  const effectivePrice = basePrice + (selectedOption?.priceDelta ?? 0);

  function handleAdd() {
    addLine({
      productId: product.id,
      name: product.name,
      image: product.image,
      basePrice,
      quantity: 1,
      variants:
        sizeGroup && selectedOption
          ? [
              {
                groupId: sizeGroup.id,
                optionId: selectedOption.id,
                optionName: selectedOption.name,
                priceDelta: selectedOption.priceDelta,
              },
            ]
          : [],
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
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
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

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display line-clamp-1 text-base font-semibold">{product.name}</h3>
        {product.shortDescription && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{product.shortDescription}</p>
        )}

        {sizeGroup && sizeGroup.options.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {sizeGroup.options.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={!option.isAvailable}
                onClick={() => setSelectedOptionId(option.id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  option.id === selectedOptionId
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:border-primary',
                )}
              >
                {option.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-primary text-lg font-bold">{formatMoney(effectivePrice)}</span>
            {hasOffer && (
              <span className="text-muted-foreground text-sm line-through">
                {formatMoney(product.price + (selectedOption?.priceDelta ?? 0))}
              </span>
            )}
          </div>
          <Button
            size="icon-sm"
            disabled={isUnavailable}
            onClick={handleAdd}
            aria-label={`Agregar ${product.name} al carrito`}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
