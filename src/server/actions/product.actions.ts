'use server';

import { revalidatePath } from 'next/cache';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { assertAdmin } from '@/lib/auth/admin-session';
import { env } from '@/config/env';
import { BusinessRuleError, ConflictError, ErrorCode } from '@/lib/errors';
import { parseMoney } from '@/lib/money';
import { fail, failFrom, ok, type ActionResult } from '@/lib/result';
import { slugify } from '@/lib/utils';
import { productRepository } from '@/server/repositories/product.repository';
import { MAX_VARIANT_OPTIONS, productFormSchema } from '@/schemas/product.schema';

type AdminResult = ActionResult<string>;

const PRODUCTS_SUBDIR = 'products';

/** Campo vacío = "vacío", no `0`: un tope de $0 pasaría la carta como gratis. */
function optionalMoney(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? '').trim();
  return raw === '' ? null : parseMoney(raw);
}

function parseProductForm(formData: FormData) {
  const options = [];
  for (let i = 0; i < MAX_VARIANT_OPTIONS; i += 1) {
    // Fila sin nombre = fila vacía: no se crea la opción.
    const name = String(formData.get(`option_${i}_name`) ?? '').trim();
    if (name === '') continue;
    options.push({
      name,
      priceDelta: parseMoney(String(formData.get(`option_${i}_priceDelta`) ?? '')),
      extraPrice: optionalMoney(formData, `option_${i}_extraPrice`),
      extraPremiumPrice: optionalMoney(formData, `option_${i}_extraPremiumPrice`),
      isAvailable: formData.get(`option_${i}_available`) !== null,
    });
  }

  const rawName = String(formData.get('name') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const rawOfferPrice = String(formData.get('offerPrice') ?? '').trim();

  return productFormSchema.safeParse({
    name: rawName,
    // Slug manual si lo tocaron; si no, se deriva del nombre.
    slug: slugify(rawSlug === '' ? rawName : rawSlug),
    categoryId: String(formData.get('categoryId') ?? ''),
    shortDescription: String(formData.get('shortDescription') ?? '').trim() || undefined,
    description: String(formData.get('description') ?? '').trim() || undefined,
    price: parseMoney(String(formData.get('price') ?? '')),
    offerPrice: rawOfferPrice === '' ? null : parseMoney(rawOfferPrice),
    prepMinutes: Number.parseInt(String(formData.get('prepMinutes') ?? '15'), 10) || 15,
    allowNotes: formData.get('allowNotes') !== null,
    isVisible: formData.get('isVisible') !== null,
    variantGroupName: String(formData.get('variantGroupName') ?? '').trim() || undefined,
    options,
  });
}

/**
 * Guarda la foto que el operador sube desde el celular (cámara o galería —
 * ver `accept="image/*"` sin `capture` en `ProductFields`, que deja elegir).
 *
 * `undefined` = no se tocó la foto (el input llegó vacío). `null` no ocurre
 * hoy: no hay botón para quitar la imagen sin reemplazarla.
 */
async function saveProductImage(formData: FormData, slug: string): Promise<string | undefined> {
  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) return undefined;

  if (!file.type.startsWith('image/')) {
    throw new BusinessRuleError('El archivo debe ser una imagen.');
  }
  if (file.size > env.MAX_UPLOAD_SIZE_BYTES) {
    const maxMb = Math.round(env.MAX_UPLOAD_SIZE_BYTES / 1024 / 1024);
    throw new BusinessRuleError(`La imagen supera el máximo de ${maxMb} MB.`);
  }

  const ext = (file.type.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
  const filename = `${slug}-${Date.now()}.${ext}`;
  const dir = path.join(env.UPLOAD_DIR, PRODUCTS_SUBDIR);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  // `UPLOAD_DIR` vive bajo `public/`: la URL servida es la misma ruta sin ese
  // prefijo. Acoplado a la convención del env, documentado por si se mueve.
  const publicDir = env.UPLOAD_DIR.replace(/^\.?\/?public\/?/, '');
  return `/${[publicDir, PRODUCTS_SUBDIR, filename].filter(Boolean).join('/')}`;
}

export async function createProductAction(_state: AdminResult | null, formData: FormData) {
  try {
    await assertAdmin();

    const parsed = parseProductForm(formData);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(first?.message ?? 'Revisa los datos del producto.', ErrorCode.VALIDATION);
    }

    const existing = await productRepository.findBySlugAny(parsed.data.slug);
    if (existing) {
      throw new ConflictError(`Ya existe un producto con el slug "${parsed.data.slug}".`);
    }

    const image = await saveProductImage(formData, parsed.data.slug);
    const product = await productRepository.createFromAdmin(parsed.data, image ?? null);

    revalidatePath('/admin');
    revalidatePath('/admin/productos');
    revalidatePath('/');
    return ok(`Producto "${product.name}" creado.`);
  } catch (error) {
    return failFrom(error);
  }
}

export async function updateProductAction(
  productId: string,
  _state: AdminResult | null,
  formData: FormData,
) {
  try {
    await assertAdmin();

    const parsed = parseProductForm(formData);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(first?.message ?? 'Revisa los datos del producto.', ErrorCode.VALIDATION);
    }

    // El slug puede coincidir con el propio producto (no se tocó): sólo es
    // conflicto si le pertenece a otra fila.
    const existing = await productRepository.findBySlugAny(parsed.data.slug);
    if (existing && existing.id !== productId) {
      throw new ConflictError(`Ya existe un producto con el slug "${parsed.data.slug}".`);
    }

    const image = await saveProductImage(formData, parsed.data.slug);
    const product = await productRepository.updateFromAdmin(productId, parsed.data, image);

    revalidatePath('/admin');
    revalidatePath('/admin/productos');
    revalidatePath('/');
    revalidatePath(`/producto/${product.slug}`);
    return ok(`Producto "${product.name}" actualizado.`);
  } catch (error) {
    return failFrom(error);
  }
}

/** Baja lógica: los pedidos históricos referencian el producto, no se borra la fila. */
export async function setProductActiveAction(
  productId: string,
  isActive: boolean,
  _state: AdminResult | null,
  _formData: FormData,
) {
  try {
    await assertAdmin();
    const product = await productRepository.setActive(productId, isActive);
    revalidatePath('/admin');
    revalidatePath('/admin/productos');
    revalidatePath('/');
    return ok(isActive ? `"${product.name}" republicado.` : `"${product.name}" eliminado.`);
  } catch (error) {
    return failFrom(error);
  }
}
