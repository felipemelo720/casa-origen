'use client';

import Image from 'next/image';
import { useState } from 'react';

import type { ProductViewImage } from '@/features/catalog/product-view';
import { cn } from '@/lib/utils';

/**
 * Galería con miniaturas.
 *
 * La ficha sólo la monta cuando hay más de una foto. Hoy cada producto tiene
 * una sola, así que en la práctica no se descarga: el caso normal se dibuja
 * server-side con un `next/image` pelado.
 */
export function ProductGallery({ images, name }: { images: ProductViewImage[]; name: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];
  if (!active) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted relative aspect-square overflow-hidden rounded-2xl">
        <Image
          src={active.url}
          alt={active.alt ?? name}
          fill
          priority
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="object-cover"
        />
      </div>

      <div role="group" aria-label={`Fotos de ${name}`} className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            aria-pressed={index === activeIndex}
            aria-label={image.alt ?? `Foto ${index + 1} de ${name}`}
            onClick={() => setActiveIndex(index)}
            className={cn(
              'bg-muted relative size-16 overflow-hidden rounded-lg border-2 transition-colors',
              index === activeIndex ? 'border-primary' : 'hover:border-border border-transparent',
            )}
          >
            <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
