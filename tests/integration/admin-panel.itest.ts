import { beforeEach, describe, expect, it } from 'vitest';

import { env } from '@/config/env';
import { prisma } from '@/lib/db/prisma';
import { deriveAdminSessionToken } from '@/lib/security/session-token';
import {
  loginAction,
  setProductAvailabilityAction,
  setProductFeaturedAction,
  toggleAcceptingOrdersAction,
  toggleDeliveryAction,
} from '@/server/actions/admin.actions';

import { resetDb } from '../setup/db';
import { cookieStore, setCookie } from '../setup/request-context';

/**
 * El resto del panel: login, los dos switches de operación y los botones por
 * producto.
 *
 * Se prueba el `ActionResult` completo y no sólo el efecto en la base porque el
 * mensaje *es* la funcionalidad: estas acciones no cambian nada visible en la
 * pantalla salvo el texto que devuelven, y sin él el operador no puede
 * distinguir «guardado» de «se cayó». Un mensaje que se rompe en silencio deja
 * el panel exactamente como estaba antes de tener feedback.
 *
 * `updateBusinessHoursAction` y `updateCommunesAction` viven en sus propios
 * archivos, que ya existían.
 */

async function signInAsAdmin(): Promise<void> {
  setCookie('admin_session', await deriveAdminSessionToken(env.ADMIN_PASSWORD));
}

function passwordForm(password: string): FormData {
  const formData = new FormData();
  formData.set('password', password);
  return formData;
}

async function anyProduct() {
  return prisma.product.findFirstOrThrow({ orderBy: { name: 'asc' } });
}

async function settings() {
  return prisma.restaurantSettings.findFirstOrThrow();
}

describe('panel de administración (integración)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('loginAction', () => {
    it('rechaza una contraseña equivocada y no abre sesión', async () => {
      const result = await loginAction(null, passwordForm('no-es-la-clave'));

      expect(result.ok).toBe(false);
      // El mensaje importa: antes una clave mala repintaba el mismo formulario
      // vacío, indistinguible de un error de red.
      if (!result.ok) expect(result.message).toBe('Contraseña incorrecta.');
      expect(cookieStore.has('admin_session')).toBe(false);
    });

    it('abre sesión con la contraseña correcta', async () => {
      const result = await loginAction(null, passwordForm(env.ADMIN_PASSWORD));

      expect(result).toEqual({ ok: true, data: 'Sesión iniciada.' });
      expect(cookieStore.has('admin_session')).toBe(true);
    });
  });

  describe('toggleAcceptingOrdersAction', () => {
    it('rechaza sin la cookie de admin y deja el negocio como estaba', async () => {
      const result = await toggleAcceptingOrdersAction(false, null, new FormData());

      expect(result.ok).toBe(false);
      expect((await settings()).acceptingOrders).toBe(true);
    });

    it('cierra y vuelve a abrir el negocio', async () => {
      await signInAsAdmin();

      expect(await toggleAcceptingOrdersAction(false, null, new FormData())).toEqual({
        ok: true,
        data: 'Negocio cerrado.',
      });
      expect((await settings()).acceptingOrders).toBe(false);

      expect(await toggleAcceptingOrdersAction(true, null, new FormData())).toEqual({
        ok: true,
        data: 'Negocio abierto.',
      });
      expect((await settings()).acceptingOrders).toBe(true);
    });
  });

  describe('toggleDeliveryAction', () => {
    it('rechaza sin la cookie de admin', async () => {
      const result = await toggleDeliveryAction(false, null, new FormData());

      expect(result.ok).toBe(false);
      expect((await settings()).deliveryEnabled).toBe(true);
    });

    it('apaga y enciende el delivery', async () => {
      await signInAsAdmin();

      expect(await toggleDeliveryAction(false, null, new FormData())).toEqual({
        ok: true,
        data: 'Delivery desactivado.',
      });
      expect((await settings()).deliveryEnabled).toBe(false);

      expect(await toggleDeliveryAction(true, null, new FormData())).toEqual({
        ok: true,
        data: 'Delivery activado.',
      });
      expect((await settings()).deliveryEnabled).toBe(true);
    });
  });

  describe('setProductAvailabilityAction', () => {
    it('rechaza sin la cookie de admin', async () => {
      const product = await anyProduct();
      await prisma.product.update({
        where: { id: product.id },
        data: { availability: 'AVAILABLE' },
      });

      const result = await setProductAvailabilityAction(product.id, false, null, new FormData());

      expect(result.ok).toBe(false);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).availability,
      ).toBe('AVAILABLE');
    });

    it('agota un producto y lo vuelve a activar', async () => {
      await signInAsAdmin();
      const product = await anyProduct();

      expect(await setProductAvailabilityAction(product.id, false, null, new FormData())).toEqual({
        ok: true,
        data: 'Producto agotado.',
      });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).availability,
      ).toBe('OUT_OF_STOCK');

      expect(await setProductAvailabilityAction(product.id, true, null, new FormData())).toEqual({
        ok: true,
        data: 'Producto disponible.',
      });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).availability,
      ).toBe('AVAILABLE');
    });
  });

  describe('setProductFeaturedAction', () => {
    it('rechaza sin la cookie de admin', async () => {
      const product = await anyProduct();

      const result = await setProductFeaturedAction(product.id, true, null, new FormData());

      expect(result.ok).toBe(false);
    });

    it('destaca un producto y lo quita', async () => {
      await signInAsAdmin();
      const product = await anyProduct();

      expect(await setProductFeaturedAction(product.id, true, null, new FormData())).toEqual({
        ok: true,
        data: 'Destacado en la portada.',
      });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).isFeatured,
      ).toBe(true);

      expect(await setProductFeaturedAction(product.id, false, null, new FormData())).toEqual({
        ok: true,
        data: 'Quitado de destacados.',
      });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).isFeatured,
      ).toBe(false);
    });
  });
});
