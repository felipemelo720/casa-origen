import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Gift, Package } from 'lucide-react';

import { AuthForm } from '@/features/account/auth-form';
import { LogoutButton } from '@/features/account/logout-button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatMoney } from '@/lib/money';
import { getCurrentCustomer } from '@/server/services/customer-auth.service';
import { customerRepository } from '@/server/repositories/customer.repository';

// Reads a session cookie, so it can never be part of the static landing.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  description: 'Revisa tus pedidos anteriores y tus datos.',
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Recibido',
  CONFIRMED: 'Confirmado',
  PREPARING: 'En preparación',
  READY: 'Listo',
  OUT_FOR_DELIVERY: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export default async function AccountPage() {
  const customer = await getCurrentCustomer();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al menú
      </Link>

      {customer === null ? (
        <>
          <h1 className="mb-2 text-center font-[family-name:var(--font-display)] text-3xl">
            Mi cuenta
          </h1>
          {/* The only incentive on offer today is future prizes and discounts:
              nothing is implemented yet, so the copy stays in the future tense.
              Promising a benefit the server cannot honour breaks principle #2. */}
          <p className="text-muted-foreground mx-auto mb-8 max-w-prose text-center">
            Guarda tus pedidos y entra a los premios y descuentos que estamos preparando para
            clientes con cuenta. También puedes pedir sin cuenta, siempre.
          </p>
          <AuthForm />
        </>
      ) : (
        <AccountDetail
          customerId={customer.id}
          name={customer.firstName}
          orderCount={customer.orderCount}
          totalSpent={customer.totalSpent}
          email={customer.email}
        />
      )}
    </div>
  );
}

async function AccountDetail({
  customerId,
  name,
  orderCount,
  totalSpent,
  email,
}: {
  customerId: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  email: string | null;
}) {
  const orders = await customerRepository.findOrdersByCustomer(customerId);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Hola, {name}</h1>
          {email ? <p className="text-muted-foreground text-sm">{email}</p> : null}
        </div>
        <LogoutButton />
      </header>

      <dl className="grid grid-cols-2 gap-4">
        <div className="border-border bg-card rounded-xl border p-4">
          <dt className="text-muted-foreground text-sm">Pedidos</dt>
          <dd className="text-2xl font-semibold">{orderCount}</dd>
        </div>
        <div className="border-border bg-card rounded-xl border p-4">
          <dt className="text-muted-foreground text-sm">Total comprado</dt>
          <dd className="text-2xl font-semibold">{formatMoney(totalSpent)}</dd>
        </div>
      </dl>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Tus pedidos</h2>

        {orders.length === 0 ? (
          <div className="border-border rounded-xl border border-dashed p-8 text-center">
            <Package className="text-muted-foreground mx-auto mb-3 size-8" aria-hidden />
            <p className="text-muted-foreground mb-4">Todavía no tienes pedidos.</p>
            <Link
              href="/#menu"
              className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-lg px-5 font-medium"
            >
              Ver el menú
            </Link>
          </div>
        ) : (
          <ul className="divide-border border-border bg-card divide-y rounded-xl border">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {order.code}
                    <Badge variant="secondary">{STATUS_LABELS[order.status] ?? order.status}</Badge>
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {order.items.map((item) => `${item.name} x${item.quantity}`).join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(order.total)}</p>
                  <p className="text-muted-foreground text-sm">
                    {order.createdAt.toLocaleDateString('es-CL')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />
      <div className="border-border rounded-xl border border-dashed p-5">
        <p className="flex items-center gap-2 font-medium">
          <Gift className="text-primary size-4" aria-hidden />
          Premios y descuentos
        </p>
        <p className="text-muted-foreground mt-1 max-w-prose text-sm">
          Estamos preparando beneficios para quienes piden con cuenta. Tus pedidos ya se están
          registrando acá, así que cuando salgan, cuentan desde el primero.
        </p>
      </div>
    </div>
  );
}
