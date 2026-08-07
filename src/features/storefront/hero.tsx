import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ClosedNotice } from '@/components/shared/closed-notice';
import type { OpenState } from '@/server/services/schedule.service';

type Props = {
  kicker: string | null;
  title: string;
  subtitle: string | null;
  image: string | null;
  open: OpenState;
};

/**
 * Editorial overlap hero: the copy sits on its own panel that rides over the
 * photo instead of on top of it. Text over a full-bleed image can only be kept
 * legible with a heavy scrim, which flattens the photo; a panel keeps WCAG
 * contrast fixed (`bg-background` on `foreground`) whatever the admin uploads.
 *
 * Server component. The stagger reuses `animate-fade-up` from `globals.css`,
 * which already opts out under `prefers-reduced-motion`.
 */
export function StorefrontHero({ kicker, title, subtitle, image, open }: Props) {
  return (
    <section className="relative overflow-hidden pb-16 lg:pb-24">
      {/* Tint behind the photo so the panel is not floating on bare background.
          A gradient, not a band: a flat block ends in a seam that reads as a
          stray rule across the layout. */}
      <div
        className="from-secondary/60 absolute inset-x-0 top-0 -z-10 h-3/4 bg-linear-to-b to-transparent"
        aria-hidden
      />

      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:grid lg:grid-cols-12 lg:items-center lg:gap-0 lg:px-8 lg:pt-16">
        <div className="relative lg:col-span-7 lg:col-start-6 lg:row-start-1">
          {/* Offset frame, the one purely decorative element: an outline nudged
              off the photo, the way a print layout registers a plate. */}
          <div
            className="border-primary/30 absolute -right-2 -bottom-2 hidden size-full rounded-2xl border-2 lg:block"
            aria-hidden
          />
          {/* 4:3, not 16:9: the photo is a vertical phone shot, and a frame that
              wide would crop it down to a band. */}
          <div className="bg-secondary relative aspect-square overflow-hidden rounded-2xl sm:aspect-4/3">
            {image && (
              <Image
                src={image}
                alt={title}
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
            )}
            {/* Only under the panel's side, so the photo keeps its own light. */}
            <div
              className="absolute inset-0 bg-linear-to-t from-black/25 to-transparent lg:bg-linear-to-r lg:from-black/25 lg:to-transparent"
              aria-hidden
            />
          </div>
        </div>

        <div className="border-border bg-background animate-fade-up relative z-10 -mt-12 rounded-2xl border p-6 shadow-lg sm:p-8 lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:p-10">
          {kicker && (
            <p className="text-primary flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase">
              <span className="bg-primary h-px w-8" aria-hidden />
              {kicker}
            </p>
          )}

          <h1 className="font-display mt-4 text-4xl leading-[1.05] font-bold text-balance sm:text-5xl lg:text-6xl">
            {title}
          </h1>

          {subtitle && (
            <p className="text-muted-foreground mt-4 max-w-prose text-base sm:text-lg">
              {subtitle}
            </p>
          )}

          {!open.isOpen && <ClosedNotice className="mt-5">{open.reason}</ClosedNotice>}

          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <a href="#menu">
                {open.isOpen ? 'Ver el menú' : 'Ver el menú igual'}
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#cobertura">¿Llegamos a ti?</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
