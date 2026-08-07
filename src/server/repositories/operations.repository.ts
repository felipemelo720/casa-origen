import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

/** Communes (delivery zones), payment methods, business hours, banners, settings. */
export const communeRepository = {
  /** Deduplicated per request: the layout loads it for the checkout and the
   *  page loads it again for `DeliveryChecker`. */
  findAllActive: cache(async () => {
    return prisma.commune.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }),
  async findAllForAdmin() {
    return prisma.commune.findMany({ orderBy: { sortOrder: 'asc' } });
  },
  async findById(id: string) {
    return prisma.commune.findUnique({ where: { id } });
  },
  async create(data: Prisma.CommuneCreateInput) {
    return prisma.commune.create({ data });
  },
  async update(id: string, data: Prisma.CommuneUpdateInput) {
    return prisma.commune.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.commune.delete({ where: { id } });
  },
};

export const paymentMethodRepository = {
  async findAllActive() {
    return prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  },
  async findAllForAdmin() {
    return prisma.paymentMethod.findMany({ orderBy: { sortOrder: 'asc' } });
  },
  async findById(id: string) {
    return prisma.paymentMethod.findUnique({ where: { id } });
  },
  async update(id: string, data: Prisma.PaymentMethodUpdateInput) {
    return prisma.paymentMethod.update({ where: { id }, data });
  },
};

export const businessHourRepository = {
  /** Deduplicated per request: `getWeeklySchedule()` runs in the layout, the
   *  page and the footer, and the seven rows are the same for all three. */
  findAll: cache(async () => {
    return prisma.businessHour.findMany({ orderBy: { dayOfWeek: 'asc' } });
  }),
  async upsertDay(
    dayOfWeek: number,
    data: { isClosed: boolean; opensAt: number; closesAt: number },
  ) {
    return prisma.businessHour.upsert({
      where: { dayOfWeek },
      update: data,
      create: { dayOfWeek, ...data },
    });
  },
};

export const bannerRepository = {
  async findActiveByPlacement(placement: Prisma.BannerWhereInput['placement']) {
    const now = new Date();
    return prisma.banner.findMany({
      where: {
        placement,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
  },
  async findAllForAdmin() {
    return prisma.banner.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] });
  },
  async findById(id: string) {
    return prisma.banner.findUnique({ where: { id } });
  },
  async create(data: Prisma.BannerCreateInput) {
    return prisma.banner.create({ data });
  },
  async update(id: string, data: Prisma.BannerUpdateInput) {
    return prisma.banner.update({ where: { id }, data });
  },
  async delete(id: string) {
    return prisma.banner.delete({ where: { id } });
  },
};

export const settingsRepository = {
  /**
   * Deduplicated per request: the layout, `generateMetadata`, the page and
   * every `getOpenState()` all want the same singleton row, and without
   * `cache()` that is four round trips for one row.
   */
  get: cache(async () => {
    const settings = await prisma.restaurantSettings.findUnique({ where: { id: 'singleton' } });
    if (settings) return settings;
    return prisma.restaurantSettings.create({ data: { id: 'singleton' } });
  }),
  async update(data: Prisma.RestaurantSettingsUpdateInput) {
    return prisma.restaurantSettings.update({ where: { id: 'singleton' }, data });
  },
};
