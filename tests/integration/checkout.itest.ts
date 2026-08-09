import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/db/prisma';
import { placeOrderAction } from '@/server/actions/checkout.actions';
import type { CheckoutInput } from '@/schemas/checkout.schema';

import { resetDb } from '../setup/db';
import { loadCatalogFixture, type CatalogFixture } from '../setup/fixtures';

/**
 * `placeOrderAction` de punta a punta: zod, rate limit, reglas de negocio,
 * pricing y escritura en Postgres.
 *
 * Los tests de `pricing.service` mockean los repositorios, así que verifican la
 * aritmética pero no que la query traiga lo que la aritmética espera. Acá no
 * hay mock de datos: si una query se rompe, esto se cae.
 */
describe('placeOrderAction (integración)', () => {
  let catalog: CatalogFixture;

  beforeAll(async () => {
    catalog = await loadCatalogFixture();
  });

  beforeEach(async () => {
    await resetDb();
  });

  function pickupOrder(): CheckoutInput {
    return {
      cart: {
        items: [
          {
            cartItemId: 'cart-item-1',
            productId: catalog.productId,
            quantity: 1,
            selectedVariantOptionIds: [catalog.size32OptionId],
            selectedExtras: [],
            removedIngredientIds: [],
          },
        ],
      },
      orderType: 'PICKUP',
      firstName: 'Felipe',
      lastName: 'Melo',
      phone: '+56911112222',
      paymentMethodId: catalog.transferPaymentMethodId,
    };
  }

  it('guarda el pedido con el precio que calcula el server, no el que manda el cliente', async () => {
    const result = await placeOrderAction(pickupOrder());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // $10.000: base de Pepperoni + el delta de 32 cm. El cliente solo mandó ids.
    expect(result.data.total).toBe(catalog.price32);
    expect(result.data.code).toMatch(/^CO-\d{6}-\d{4}$/);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.data.id },
      include: { items: true },
    });
    expect(order.total).toBe(catalog.price32);
    expect(order.type).toBe('PICKUP');
    expect(order.deliveryFee).toBe(0);
    expect(order.items).toHaveLength(1);

    // El contador de «más pedidos» se mueve dentro de la misma transacción.
    const product = await prisma.product.findUniqueOrThrow({ where: { id: catalog.productId } });
    expect(product.soldCount).toBe(1);
  });

  it('rechaza DELIVERY con el delivery apagado, aunque la UI lo esconda', async () => {
    await prisma.restaurantSettings.updateMany({ data: { deliveryEnabled: false } });

    const result = await placeOrderAction({
      ...pickupOrder(),
      orderType: 'DELIVERY',
      street: 'Avenida Siempre Viva 742',
      communeId: catalog.communeId,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('delivery no está disponible');

    // Lo que importa no es el mensaje sino que no quedó nada escrito.
    expect(await prisma.order.count()).toBe(0);
  });

  it('rechaza el carrito vacío antes de tocar la base', async () => {
    const result = await placeOrderAction({ ...pickupOrder(), cart: { items: [] } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toBeDefined();
    expect(await prisma.order.count()).toBe(0);
  });
});
