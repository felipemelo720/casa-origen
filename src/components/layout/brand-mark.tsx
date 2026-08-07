import { cn } from '@/lib/utils';

// Shared by the header and footer. The wordmark PNG (`public/logo.png`) is a
// solid white silhouette with a transparent background, so it must be
// rendered as a `currentColor` mask rather than an `<img>` — painted flat it
// would vanish against the light-theme `--background`. The box is sized by
// height + `aspect-ratio` (source 640:231) instead of a fixed px width, so it
// can shrink inside a cramped header without ever painting outside its own
// box — a fixed width did overflow the flex item and ran under the open/closed
// badge on a phone.
const RATIO = '640 / 231';

export function BrandMark({ logo, className }: { logo: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('text-foreground block h-7 max-w-full sm:h-9', className)}
      style={{
        aspectRatio: RATIO,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${logo})`,
        maskImage: `url(${logo})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'left center',
        maskPosition: 'left center',
      }}
    />
  );
}
