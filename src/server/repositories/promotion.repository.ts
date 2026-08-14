import 'server-only';

import { prisma } from '@/lib/db/prisma';
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
  async findAllForAdmin() {
    return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  },
  async findById(id: string) {
    return prisma.coupon.findUnique({ where: { id } });
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
  async incrementUsage(couponId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.coupon.update({ where: { id: couponId }, data: { usageCount: { increment: 1 } } });
  },
  async createRedemption(
    data: Prisma.CouponRedemptionCreateInput,
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.couponRedemption.create({ data });
  },
};
