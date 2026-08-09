import { prisma } from '@/lib/db/prisma';

/**
 * Tablas transaccionales: todo lo que un test puede ensuciar.
 *
 * El catálogo (productos, tamaños, extras, comunas, métodos de pago) **no**
 * entra: lo pone el seed una vez en `global-setup.ts` y volver a sembrarlo
 * entre tests costaría más que todos los tests juntos.
 */
const TRANSACTIONAL_TABLES = [
  'order_item_extras',
  'order_item_variants',
  'order_items',
  'order_status_history',
  'orders',
  'coupon_redemptions',
  'customer_addresses',
  'customers',
  'counters',
  'business_hours',
] as const;

/** Deja la base como recién sembrada, sin volver a sembrarla. */
export async function resetDb(): Promise<void> {
  // Un `TRUNCATE` contra la base de desarrollo borraría los pedidos reales.
  // La guarda es el nombre, porque es lo único que está a la vista cuando
  // alguien copia un `DATABASE_URL` de otra terminal.
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('_test')) {
    throw new Error(`resetDb() abortado: DATABASE_URL no apunta a una base de test (${url})`);
  }

  const tables = TRANSACTIONAL_TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);

  // Contadores y switches que viven en tablas que el truncate no toca.
  await prisma.product.updateMany({ data: { soldCount: 0 } });
  await prisma.restaurantSettings.updateMany({
    data: { acceptingOrders: true, deliveryEnabled: true },
  });
}
