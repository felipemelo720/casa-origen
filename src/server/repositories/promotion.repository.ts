import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { CreateCouponInput } from '@/schemas/coupon.schema';
import type { Prisma } from '@prisma/client';

/**
 * Lo que el armador de la promo necesita, ni más ni menos. Compartido entre la
 * card de la landing y la página propia de la promo para que las dos rutas no
 * puedan traer campos distintos y renderizar precios distintos.
 */
const bundleSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  value: true,
  scope: true,
  bundleSize: true,
  bundleVariantName: true,
  bundleSizeLabel: true,
  image: true,
  products: { select: { productId: true } },
} satisfies Prisma.PromotionSelect;

export const promotionRepository = {
  /** Currently active promotions, cheapest query needed by the pricing engine. */
  async findActive() {
    const now = new Date();
    return prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { priority: 'desc' },
      include: {
        categories: { select: { categoryId: true } },
        products: { select: { productId: true } },
      },
    });
  },
  /**
   * The bundle the landing advertises above the menu. `findFirst` and not
   * `findMany`: the home has one builder, so two featured bundles would be a
   * silent race — the highest priority wins and the rest stay redeemable in
   * the cart without a card of their own.
   */
  async findFeaturedBundle() {
    const now = new Date();
    return prisma.promotion.findFirst({
      where: {
        isActive: true,
        isFeatured: true,
        discountType: 'BUNDLE_PRICE',
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { priority: 'desc' },
      select: bundleSelect,
    });
  },
  /**
   * La misma promoción, pedida por slug para su página propia.
   *
   * No exige `isFeatured`: destacada es lo que decide si la landing pinta la
   * card, no si la promo existe. Sí exige vigencia — una página que sigue
   * ofreciendo un precio vencido es exactamente lo que el checkout rechaza.
   */
  async findBundleBySlug(slug: string) {
    const now = new Date();
    return prisma.promotion.findFirst({
      where: {
        slug,
        isActive: true,
        discountType: 'BUNDLE_PRICE',
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      select: bundleSelect,
    });
  },
  async findAllForAdmin() {
    return prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  },
  async findById(id: string) {
    return prisma.promotion.findUnique({
      where: { id },
      include: { categories: true, products: true },
    });
  },
  async create(data: Prisma.PromotionCreateInput) {
    return prisma.promotion.create({ data });
  },
  async update(id: string, data: Prisma.PromotionUpdateInput) {
    return prisma.promotion.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.promotion.delete({ where: { id } });
  },
};

export const couponRepository = {
  async findByCode(code: string) {
    return prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  },
  /** Lo que la lista del panel pinta, sin `createdAt/updatedAt` ni relaciones. */
  async findAllForAdmin() {
    return prisma.coupon.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        code: true,
        description: true,
        discountType: true,
        value: true,
        minSubtotal: true,
        maxDiscount: true,
        freeDelivery: true,
        usageLimit: true,
        usageCount: true,
        perCustomerLimit: true,
        isActive: true,
        isPublic: true,
        endsAt: true,
      },
    });
  },
  async findById(id: string) {
    return prisma.coupon.findUnique({ where: { id } });
  },
  /**
   * El cupón que la landing puede publicitar: activo, público, vigente y con
   * cupo. `findFirst`, un solo banner — mismo criterio que
   * `findFeaturedBundle`. Sin el chequeo de cupo/vigencia el banner podría
   * anunciar un código que `priceCart` ya rechaza.
   */
  async findPublicActive() {
    const now = new Date();
    return prisma.coupon.findFirst({
      where: {
        isActive: true,
        isPublic: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        AND: [
          {
            OR: [{ usageLimit: null }, { usageCount: { lt: prisma.coupon.fields.usageLimit } }],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        code: true,
        discountType: true,
        value: true,
        minSubtotal: true,
        maxDiscount: true,
        freeDelivery: true,
      },
    });
  },
  /**
   * Alta desde el panel. Toma el tipo del schema y no `Prisma.CouponCreateInput`
   * para que la action no tenga que importar tipos de Prisma: la forma la manda
   * el formulario validado, no la tabla.
   *
   * `startsAt` es ahora y no un campo del formulario: un cupón que se crea es
   * un cupón que empieza. Programar uno a futuro no es algo que se pida desde
   * el teléfono con el local abierto.
   */
  async createFromAdmin(input: CreateCouponInput) {
    return prisma.coupon.create({
      data: {
        code: input.code,
        description: input.description,
        discountType: input.discountType,
        value: input.value,
        minSubtotal: input.minSubtotal,
        maxDiscount: input.maxDiscount,
        usageLimit: input.usageLimit,
        perCustomerLimit: input.perCustomerLimit,
        freeDelivery: input.freeDelivery,
        isActive: input.isActive,
        isPublic: input.isPublic,
        startsAt: new Date(),
        endsAt: input.endsAt,
      },
    });
  },
  /**
   * Edición desde el panel. Mismo shape que `createFromAdmin` — pero no toca
   * `startsAt` (un cupón no se reprograma, se crea uno nuevo) ni `usageCount`
   * (es derivado; editarlo permitiría resetear el abuso).
   */
  async updateFromAdmin(id: string, input: CreateCouponInput) {
    return prisma.coupon.update({
      where: { id },
      data: {
        code: input.code,
        description: input.description,
        discountType: input.discountType,
        value: input.value,
        minSubtotal: input.minSubtotal,
        maxDiscount: input.maxDiscount,
        usageLimit: input.usageLimit,
        perCustomerLimit: input.perCustomerLimit,
        freeDelivery: input.freeDelivery,
        isActive: input.isActive,
        isPublic: input.isPublic,
        endsAt: input.endsAt,
      },
    });
  },
  /**
   * Único cambio de estado que ofrece el panel fuera de la edición completa.
   * No hay borrar: la fila la referencian `coupon_redemptions` con
   * `onDelete: Cascade`, así que borrar un cupón se lleva por delante el
   * historial de quién lo usó.
   */
  async setActive(id: string, isActive: boolean) {
    return prisma.coupon.update({ where: { id }, data: { isActive } });
  },
  async create(data: Prisma.CouponCreateInput) {
    return prisma.coupon.create({ data: { ...data, code: (data.code as string).toUpperCase() } });
  },
  async update(id: string, data: Prisma.CouponUpdateInput) {
    return prisma.coupon.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.coupon.delete({ where: { id } });
  },
  /** Redemptions by this customer, used to enforce `perCustomerLimit`. */
  async countCustomerRedemptions(couponId: string, customerId: string) {
    return prisma.couponRedemption.count({ where: { couponId, customerId } });
  },
  /**
   * Increments `usageCount` only while it is still under `usageLimit`, in a
   * single statement. `priceCart` also checks the limit, but that check runs
   * when the cart is quoted and another order can take the last redemption
   * before this one commits: unless the read and the write are the same
   * statement the limit is advisory. Returns `false` when the coupon ran out,
   * so the caller can abort the order instead of overselling it.
   */
  async consumeUsage(couponId: string, tx: Prisma.TransactionClient = prisma): Promise<boolean> {
    const { count } = await tx.coupon.updateMany({
      where: {
        id: couponId,
        // `usageCount < NULL` is NULL, never true, so an unlimited coupon needs
        // its own branch instead of relying on the comparison.
        OR: [{ usageLimit: null }, { usageCount: { lt: prisma.coupon.fields.usageLimit } }],
      },
      data: { usageCount: { increment: 1 } },
    });
    return count > 0;
  },
  async createRedemption(
    data: Prisma.CouponRedemptionCreateInput,
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.couponRedemption.create({ data });
  },
};
