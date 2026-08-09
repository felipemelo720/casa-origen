import type { SVGProps } from 'react';

/**
 * lucide-react has no motorcycle (only `Bike`), and the delivery here is on a
 * moto, not a bicycle. Drawn on the lucide grid — 24x24, stroke `currentColor`,
 * width 2, round caps — so it sizes and colors exactly like the icons next to
 * it and needs no new dependency.
 */
export function MotorcycleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M16.5 9.5h-5L9 12H4" />
      <path d="M9.5 12v3.5h4l1-3.5" />
      <path d="m17.5 9 1 5" />
      <path d="M15.5 8H19" />
    </svg>
  );
}
