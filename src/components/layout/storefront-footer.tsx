import Link from 'next/link';
import { Instagram, Facebook, MapPin, Phone } from 'lucide-react';

export function StorefrontFooter({
  restaurantName,
  phone,
  address,
  instagramUrl,
  facebookUrl,
}: {
  restaurantName: string;
  phone: string | null;
  address: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
}) {
  return (
    <footer className="border-border bg-secondary/40 mt-24 border-t">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-lg font-bold">{restaurantName}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Cocina de origen, sabor de siempre.
          </p>
          <div className="mt-4 flex gap-3">
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram className="text-muted-foreground hover:text-primary size-5" />
              </a>
            )}
            {facebookUrl && (
              <a href={facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook className="text-muted-foreground hover:text-primary size-5" />
              </a>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-medium">Contacto</p>
          {phone && (
            <p className="text-muted-foreground flex items-center gap-2">
              <Phone className="size-4" /> {phone}
            </p>
          )}
          {address && (
            <p className="text-muted-foreground flex items-center gap-2">
              <MapPin className="size-4" /> {address}
            </p>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-medium">Enlaces</p>
          <Link href="/menu" className="text-muted-foreground hover:text-primary block">
            Menú
          </Link>
          <Link href="/pedido" className="text-muted-foreground hover:text-primary block">
            Seguir mi pedido
          </Link>
        </div>
      </div>

      <div className="border-border border-t px-4 py-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
        © {new Date().getFullYear()} {restaurantName}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
