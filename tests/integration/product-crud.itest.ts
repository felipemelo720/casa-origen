import { existsSync } from 'node:fs';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { env } from '@/config/env';
import { prisma } from '@/lib/db/prisma';
import { deriveAdminSessionToken } from '@/lib/security/session-token';
import {
  createProductAction,
  setProductActiveAction,
  updateProductAction,
} from '@/server/actions/product.actions';

import { resetDb } from '../setup/db';
import { setCookie } from '../setup/request-context';

/**
 * CRUD de `/admin/productos`: alta, edición, foto y baja lógica.
 *
 * El catálogo no entra en `resetDb()` (lo siembra `global-setup.ts` una vez),
 * así que cada test crea sus propios productos con el prefijo `SLUG` y el
 * `afterEach` los borra junto con sus fotos. Nunca se editan los del seed: un
 * test que los ensucie rompe a los demás archivos que asumen la carta real.
 */

const SLUG = 'crud-test';
const uploadDir = path.join(env.UPLOAD_DIR, 'products');

async function signInAsAdmin(): Promise<void> {
  setCookie('admin_session', await deriveAdminSessionToken(env.ADMIN_PASSWORD));
}

async function categoryId(): Promise<string> {
  return (await prisma.category.findFirstOrThrow({ orderBy: { sortOrder: 'asc' } })).id;
}

async function uploadedFiles(): Promise<string[]> {
  const files = await readdir(uploadDir).catch(() => [] as string[]);
  return files.filter((file) => file.startsWith(SLUG));
}

function imageFile(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], 'foto.jpg', { type: 'image/jpeg' });
}

function productForm(
  fields: { categoryId: string; slug?: string; name?: string; price?: string },
  opts: { image?: File; options?: { name: string; priceDelta: string }[] } = {},
): FormData {
  const formData = new FormData();
  formData.set('name', fields.name ?? 'Pizza de prueba');
  formData.set('slug', fields.slug ?? SLUG);
  formData.set('categoryId', fields.categoryId);
  formData.set('price', fields.price ?? '9990');
  formData.set('isVisible', 'on');
  if (opts.image) formData.set('image', opts.image);
  if (opts.options) formData.set('variantGroupName', 'Tamaño');
  opts.options?.forEach((option, i) => {
    formData.set(`option_${i}_name`, option.name);
    formData.set(`option_${i}_priceDelta`, option.priceDelta);
    formData.set(`option_${i}_available`, 'on');
  });
  return formData;
}

async function findTestProduct(slug = SLUG) {
  return prisma.product.findUniqueOrThrow({
    where: { slug },
    include: { variantGroups: { include: { options: { orderBy: { sortOrder: 'asc' } } } } },
  });
}

describe('CRUD de productos (integración)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: SLUG } } });
    for (const file of await uploadedFiles()) await unlink(path.join(uploadDir, file));
  });

  describe('createProductAction', () => {
    it('rechaza sin la cookie de admin y no crea nada', async () => {
      const result = await createProductAction(
        null,
        productForm({ categoryId: await categoryId() }),
      );

      expect(result.ok).toBe(false);
      expect(await prisma.product.count({ where: { slug: SLUG } })).toBe(0);
    });

    it('crea el producto con precio entero y sus tamaños', async () => {
      await signInAsAdmin();
      const form = productForm(
        { categoryId: await categoryId(), price: '$12.990' },
        {
          options: [
            { name: 'Mediana', priceDelta: '0' },
            { name: 'Familiar', priceDelta: '4.000' },
          ],
        },
      );

      expect(await createProductAction(null, form)).toEqual({
        ok: true,
        data: 'Producto "Pizza de prueba" creado.',
      });

      const product = await findTestProduct();
      expect(product.price).toBe(12990);
      expect(product.image).toBeNull();
      const options = product.variantGroups[0]?.options ?? [];
      expect(options.map((o) => [o.name, o.priceDelta, o.isDefault])).toEqual([
        ['Mediana', 0, true],
        ['Familiar', 4000, false],
      ]);
    });

    it('rechaza un slug que ya existe', async () => {
      await signInAsAdmin();
      const cat = await categoryId();
      await createProductAction(null, productForm({ categoryId: cat }));

      const result = await createProductAction(null, productForm({ categoryId: cat }));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain(SLUG);
      expect(await prisma.product.count({ where: { slug: SLUG } })).toBe(1);
    });

    it('rechaza precio 0 con el mensaje del schema', async () => {
      await signInAsAdmin();

      const result = await createProductAction(
        null,
        productForm({ categoryId: await categoryId(), price: '0' }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe('El precio debe ser mayor a 0.');
    });

    it('guarda la foto y la sirve bajo /uploads/products', async () => {
      await signInAsAdmin();

      await createProductAction(
        null,
        productForm({ categoryId: await categoryId() }, { image: imageFile() }),
      );

      const [file] = await uploadedFiles();
      expect(file).toBeDefined();
      expect((await findTestProduct()).image).toBe(`/uploads/products/${file}`);
    });

    it('si la base rechaza el alta, no deja la foto en disco', async () => {
      await signInAsAdmin();

      const result = await createProductAction(
        null,
        productForm({ categoryId: 'no-existe' }, { image: imageFile() }),
      );

      expect(result.ok).toBe(false);
      expect(await uploadedFiles()).toEqual([]);
    });
  });

  describe('updateProductAction', () => {
    it('rechaza sin la cookie de admin', async () => {
      await signInAsAdmin();
      const cat = await categoryId();
      await createProductAction(null, productForm({ categoryId: cat }));
      const { id } = await findTestProduct();
      setCookie('admin_session', 'invalida');

      const result = await updateProductAction(
        id,
        null,
        productForm({ categoryId: cat, price: '1' }),
      );

      expect(result.ok).toBe(false);
      expect((await findTestProduct()).price).toBe(9990);
    });

    it('edita campos y reemplaza los tamaños enteros', async () => {
      await signInAsAdmin();
      const cat = await categoryId();
      await createProductAction(
        null,
        productForm({ categoryId: cat }, { options: [{ name: 'Mediana', priceDelta: '0' }] }),
      );
      const { id } = await findTestProduct();

      const result = await updateProductAction(
        id,
        null,
        productForm(
          { categoryId: cat, name: 'Pizza editada', price: '10990' },
          { options: [{ name: 'Individual', priceDelta: '-3000' }] },
        ),
      );

      expect(result).toEqual({ ok: true, data: 'Producto "Pizza editada" actualizado.' });
      const product = await findTestProduct();
      expect(product.price).toBe(10990);
      expect(product.variantGroups).toHaveLength(1);
      expect(product.variantGroups[0]?.options.map((o) => o.name)).toEqual(['Individual']);
    });

    it('conserva su propio slug pero rechaza el de otro producto', async () => {
      await signInAsAdmin();
      const cat = await categoryId();
      await createProductAction(null, productForm({ categoryId: cat }));
      await createProductAction(null, productForm({ categoryId: cat, slug: `${SLUG}-otro` }));
      const { id } = await findTestProduct();

      expect((await updateProductAction(id, null, productForm({ categoryId: cat }))).ok).toBe(true);

      const clash = await updateProductAction(
        id,
        null,
        productForm({ categoryId: cat, slug: `${SLUG}-otro` }),
      );
      expect(clash.ok).toBe(false);
      expect((await prisma.product.findUniqueOrThrow({ where: { id } })).slug).toBe(SLUG);
    });

    it('sin foto nueva no toca la foto actual', async () => {
      await signInAsAdmin();
      const cat = await categoryId();
      await createProductAction(null, productForm({ categoryId: cat }, { image: imageFile() }));
      const before = await findTestProduct();

      await updateProductAction(before.id, null, productForm({ categoryId: cat, name: 'Otro' }));

      expect((await findTestProduct()).image).toBe(before.image);
      expect(await uploadedFiles()).toHaveLength(1);
    });

    it('al reemplazar la foto borra la vieja del disco', async () => {
      await signInAsAdmin();
      const cat = await categoryId();
      await createProductAction(null, productForm({ categoryId: cat }, { image: imageFile() }));
      const before = await findTestProduct();
      // El nombre del archivo lleva `Date.now()`: sin la pausa, las dos fotos
      // pueden caer en el mismo milisegundo y pisarse.
      await new Promise((resolve) => setTimeout(resolve, 5));

      await updateProductAction(
        before.id,
        null,
        productForm({ categoryId: cat }, { image: imageFile() }),
      );

      const after = await findTestProduct();
      const files = await uploadedFiles();
      expect(after.image).not.toBe(before.image);
      expect(files).toHaveLength(1);
      expect(after.image).toBe(`/uploads/products/${files[0]}`);
    });

    it('no borra fotos del seed fuera de UPLOAD_DIR', async () => {
      await signInAsAdmin();
      const cat = await categoryId();
      await createProductAction(null, productForm({ categoryId: cat }));
      const { id } = await findTestProduct();
      await prisma.product.update({ where: { id }, data: { image: '/menu/pepperoni.jpg' } });

      await updateProductAction(id, null, productForm({ categoryId: cat }, { image: imageFile() }));

      expect(existsSync(path.join(process.cwd(), 'public', 'menu', 'pepperoni.jpg'))).toBe(true);
    });

    it('si la base rechaza la edición, no deja la foto nueva en disco', async () => {
      await signInAsAdmin();

      const result = await updateProductAction(
        'no-existe',
        null,
        productForm({ categoryId: await categoryId() }, { image: imageFile() }),
      );

      expect(result.ok).toBe(false);
      expect(await uploadedFiles()).toEqual([]);
    });
  });

  describe('setProductActiveAction', () => {
    it('rechaza sin la cookie de admin', async () => {
      await signInAsAdmin();
      await createProductAction(null, productForm({ categoryId: await categoryId() }));
      const { id } = await findTestProduct();
      setCookie('admin_session', 'invalida');

      expect((await setProductActiveAction(id, false, null, new FormData())).ok).toBe(false);
      expect((await findTestProduct()).isActive).toBe(true);
    });

    it('da de baja sin borrar la fila y la republica', async () => {
      await signInAsAdmin();
      await createProductAction(null, productForm({ categoryId: await categoryId() }));
      const { id } = await findTestProduct();

      expect(await setProductActiveAction(id, false, null, new FormData())).toEqual({
        ok: true,
        data: '"Pizza de prueba" eliminado.',
      });
      expect((await findTestProduct()).isActive).toBe(false);

      expect(await setProductActiveAction(id, true, null, new FormData())).toEqual({
        ok: true,
        data: '"Pizza de prueba" republicado.',
      });
      expect((await findTestProduct()).isActive).toBe(true);
    });
  });
});
