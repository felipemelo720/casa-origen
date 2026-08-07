// Shared by the header and footer. The wordmark PNG (`public/logo.png`) is a
// solid white silhouette with a transparent background, so it must be
// rendered as a `currentColor` mask rather than an `<img>` — painted flat it
// would vanish against the light-theme `--background`. Fixed px box (source
// ratio 640:231) avoids CLS since the shape loads with the box already sized.
const RATIO = 640 / 231;

export function BrandMark({ logo, heightPx = 36 }: { logo: string; heightPx?: number }) {
  const width = Math.round(heightPx * RATIO);

  return (
    <span
      aria-hidden
      className="text-foreground shrink-0"
      style={{
        height: heightPx,
        width,
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
