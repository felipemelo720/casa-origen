/**
 * Idempotent database seed.
 *
 * Safe to run repeatedly: every write is an upsert keyed by a natural unique
 * column, so re-running only reconciles drift (new permissions, renamed
 * labels) without duplicating catalogue data.
 */
import { PrismaClient, PaymentMethodCode, BannerPlacement } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function seedSettings() {
  await prisma.restaurantSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      name: 'Casa Origen',
      tagline: 'Cocina de origen, sabor de siempre',
      description:
        'Cocina chilena contemporánea preparada con ingredientes de productores locales.',
      email: 'contacto@casaorigen.cl',
      phone: '+56 2 2345 6789',
      whatsapp: '+56912345678',
      address: 'Av. Providencia 1234, Providencia, Santiago',
      instagramUrl: 'https://instagram.com/casaorigen',
      acceptingOrders: true,
      defaultDeliveryFee: 2500,
      freeDeliveryFrom: 35000,
      minOrderAmount: 8000,
      defaultPrepMinutes: 25,
      deliveryEtaMinutes: 45,
      pickupEtaMinutes: 20,
      taxRate: 19,
      taxIncluded: true,
      seoTitle: 'Casa Origen — Cocina chilena con delivery',
      seoDescription:
        'Pide en línea platos de cocina chilena contemporánea. Delivery y retiro en tienda.',
    },
  });
}

async function seedPaymentMethods() {
  const methods = [
    {
      code: PaymentMethodCode.CASH,
      name: 'Efectivo',
      requiresChange: true,
      sortOrder: 1,
      description: 'Paga al recibir tu pedido.',
    },
    {
      code: PaymentMethodCode.DEBIT,
      name: 'Débito',
      requiresChange: false,
      sortOrder: 2,
      description: 'Máquina POS a domicilio.',
    },
    {
      code: PaymentMethodCode.CREDIT,
      name: 'Crédito',
      requiresChange: false,
      sortOrder: 3,
      description: 'Máquina POS a domicilio.',
    },
    {
      code: PaymentMethodCode.TRANSFER,
      name: 'Transferencia',
      requiresChange: false,
      sortOrder: 4,
      description: 'Te enviaremos los datos bancarios al confirmar.',
      instructions:
        'Casa Origen SpA · RUT 77.123.456-7 · Banco de Chile · Cuenta Corriente 000-12345-67 · pagos@casaorigen.cl',
    },
  ];

  for (const method of methods) {
    await prisma.paymentMethod.upsert({
      where: { code: method.code },
      update: { name: method.name, description: method.description, sortOrder: method.sortOrder },
      create: method,
    });
  }
}

async function seedBusinessHours() {
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    const isMonday = dayOfWeek === 1;
    await prisma.businessHour.upsert({
      where: { dayOfWeek },
      update: {},
      create: {
        dayOfWeek,
        isClosed: isMonday,
        opensAt: 12 * 60,
        closesAt: dayOfWeek === 5 || dayOfWeek === 6 ? 23 * 60 + 30 : 23 * 60,
      },
    });
  }
}

async function seedCommunes() {
  const communes = [
    { name: 'Providencia', deliveryFee: 2500, minOrder: 8000, extraMinutes: 0 },
    { name: 'Ñuñoa', deliveryFee: 2900, minOrder: 8000, extraMinutes: 5 },
    { name: 'Las Condes', deliveryFee: 3900, minOrder: 12000, extraMinutes: 10 },
    { name: 'Santiago Centro', deliveryFee: 2900, minOrder: 8000, extraMinutes: 5 },
    { name: 'La Reina', deliveryFee: 3900, minOrder: 12000, extraMinutes: 12 },
    { name: 'Macul', deliveryFee: 3200, minOrder: 10000, extraMinutes: 8 },
    { name: 'Vitacura', deliveryFee: 4500, minOrder: 15000, extraMinutes: 15 },
    { name: 'San Miguel', deliveryFee: 3500, minOrder: 10000, extraMinutes: 12 },
  ];

  for (const [index, commune] of communes.entries()) {
    await prisma.commune.upsert({
      where: { slug: slugify(commune.name) },
      update: { deliveryFee: commune.deliveryFee, minOrder: commune.minOrder },
      create: { ...commune, slug: slugify(commune.name), sortOrder: index },
    });
  }
}

async function seedTagsAndIngredients() {
  const tags = [
    { name: 'Nuevo', color: '#e2725b' },
    { name: 'Más vendido', color: '#c9a227' },
    { name: 'Picante', color: '#c0392b' },
    { name: 'Vegetariano', color: '#2e8b57' },
    { name: 'Sin gluten', color: '#4a7fb5' },
    { name: 'Recomendado', color: '#7a5195' },
  ];

  for (const [index, tag] of tags.entries()) {
    await prisma.tag.upsert({
      where: { slug: slugify(tag.name) },
      update: { color: tag.color },
      create: { ...tag, slug: slugify(tag.name), sortOrder: index },
    });
  }

  const ingredients = [
    { name: 'Tomate', isAllergen: false },
    { name: 'Cebolla', isAllergen: false },
    { name: 'Cilantro', isAllergen: false },
    { name: 'Palta', isAllergen: false },
    { name: 'Queso', isAllergen: true },
    { name: 'Mayonesa', isAllergen: true },
    { name: 'Ají verde', isAllergen: false },
    { name: 'Mantequilla', isAllergen: true },
    { name: 'Frutos secos', isAllergen: true },
    { name: 'Pimentón', isAllergen: false },
    { name: 'Choclo', isAllergen: false },
    { name: 'Merkén', isAllergen: false },
    { name: 'Aceituna', isAllergen: false },
    { name: 'Champiñón', isAllergen: false },
    { name: 'Jamón', isAllergen: false },
    { name: 'Piña', isAllergen: false },
    { name: 'Orégano', isAllergen: false },
    { name: 'Ajo', isAllergen: false },
  ];

  for (const ingredient of ingredients) {
    await prisma.ingredient.upsert({
      where: { slug: slugify(ingredient.name) },
      update: {},
      create: { ...ingredient, slug: slugify(ingredient.name) },
    });
  }
}

async function seedExtras() {
  const extras = [
    { name: 'Queso extra', price: 1500 },
    { name: 'Palta extra', price: 2000 },
    { name: 'Huevo frito', price: 1200 },
    { name: 'Tocino', price: 2200 },
    { name: 'Salsa de la casa', price: 900 },
    { name: 'Papas fritas', price: 3500 },
    { name: 'Ensalada chilena', price: 2800 },
    { name: 'Pebre', price: 800 },
  ];

  for (const [index, extra] of extras.entries()) {
    await prisma.extra.upsert({
      where: { slug: slugify(extra.name) },
      update: { price: extra.price },
      create: { ...extra, slug: slugify(extra.name), sortOrder: index },
    });
  }
}

type ProductSeed = {
  name: string;
  shortDescription: string;
  description: string;
  price: number;
  offerPrice?: number;
  prepMinutes: number;
  isFeatured?: boolean;
  image: string;
  tags?: string[];
  ingredients?: string[];
  variants?: { name: string; options: { name: string; priceDelta: number; isDefault?: boolean }[] }[];
  extras?: string[];
};

type CategorySeed = {
  name: string;
  description: string;
  icon: string;
  children?: { name: string; description: string; products: ProductSeed[] }[];
  products?: ProductSeed[];
};

const PIZZA_SIZE_VARIANT = {
  name: 'Tamaño',
  options: [
    { name: 'Personal 25cm', priceDelta: 0, isDefault: true },
    { name: 'Mediana 30cm', priceDelta: 3500 },
    { name: 'Familiar 40cm', priceDelta: 7500 },
  ],
};

const PIZZA_EXTRAS = ['Queso extra', 'Tocino', 'Palta extra'];

const CATALOGUE: CategorySeed[] = [
  {
    name: 'Pizzas',
    description: 'Masa artesanal, horneadas al momento',
    icon: 'Pizza',
    products: [
      {
        name: 'Margherita',
        shortDescription: 'Tomate, mozzarella y albahaca',
        description: 'La clásica: salsa de tomate natural, mozzarella fresca, albahaca y un hilo de aceite de oliva.',
        price: 8900,
        prepMinutes: 20,
        isFeatured: true,
        image: 'https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?auto=format&fit=crop&w=1200&q=80',
        tags: ['Vegetariano', 'Más vendido'],
        ingredients: ['Tomate', 'Queso'],
        extras: PIZZA_EXTRAS,
        variants: [PIZZA_SIZE_VARIANT],
      },
      {
        name: 'Napolitana',
        shortDescription: 'Tomate, mozzarella, ajo y aceituna',
        description: 'Salsa de tomate, mozzarella, ajo laminado, aceitunas y orégano fresco.',
        price: 9500,
        prepMinutes: 20,
        image: 'https://images.unsplash.com/photo-1548365328-9f547fb0953b?auto=format&fit=crop&w=1200&q=80',
        tags: ['Vegetariano'],
        ingredients: ['Tomate', 'Queso', 'Aceituna', 'Ajo'],
        extras: PIZZA_EXTRAS,
        variants: [PIZZA_SIZE_VARIANT],
      },
      {
        name: 'Pepperoni',
        shortDescription: 'Doble pepperoni y mozzarella',
        description: 'Salsa de tomate, abundante mozzarella y doble capa de pepperoni horneado hasta dorar.',
        price: 10900,
        prepMinutes: 22,
        isFeatured: true,
        image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=1200&q=80',
        tags: ['Más vendido'],
        ingredients: ['Tomate', 'Queso'],
        extras: PIZZA_EXTRAS,
        variants: [PIZZA_SIZE_VARIANT],
      },
      {
        name: 'Hawaiana',
        shortDescription: 'Jamón y piña',
        description: 'Salsa de tomate, mozzarella, jamón artesanal y piña caramelizada al horno.',
        price: 10500,
        prepMinutes: 20,
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80',
        ingredients: ['Tomate', 'Queso', 'Jamón', 'Piña'],
        extras: PIZZA_EXTRAS,
        variants: [PIZZA_SIZE_VARIANT],
      },
      {
        name: 'Cuatro Quesos',
        shortDescription: 'Mozzarella, parmesano, gorgonzola y provolone',
        description: 'Base blanca con cuatro quesos gratinados: mozzarella, parmesano, gorgonzola y provolone.',
        price: 11900,
        offerPrice: 10500,
        prepMinutes: 22,
        image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=1200&q=80',
        tags: ['Vegetariano', 'Recomendado'],
        ingredients: ['Queso'],
        extras: PIZZA_EXTRAS,
        variants: [PIZZA_SIZE_VARIANT],
      },
      {
        name: 'Vegetariana',
        shortDescription: 'Pimentón, champiñón, cebolla y aceituna',
        description: 'Salsa de tomate, mozzarella, pimentón, champiñón salteado, cebolla morada y aceitunas.',
        price: 10500,
        prepMinutes: 22,
        image: 'https://images.unsplash.com/photo-1511689660979-10d2b1aada49?auto=format&fit=crop&w=1200&q=80',
        tags: ['Vegetariano'],
        ingredients: ['Tomate', 'Queso', 'Pimentón', 'Champiñón', 'Cebolla', 'Aceituna'],
        extras: PIZZA_EXTRAS,
        variants: [PIZZA_SIZE_VARIANT],
      },
      {
        name: 'Especial Casa Origen',
        shortDescription: 'Pepperoni, tocino, champiñón y merkén',
        description: 'Nuestra firma: pepperoni, tocino ahumado, champiñón salteado, mozzarella y un toque de merkén.',
        price: 12900,
        prepMinutes: 25,
        isFeatured: true,
        image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=1200&q=80',
        tags: ['Nuevo', 'Picante'],
        ingredients: ['Tomate', 'Queso', 'Champiñón', 'Merkén'],
        extras: PIZZA_EXTRAS,
        variants: [PIZZA_SIZE_VARIANT],
      },
    ],
  },
];

async function upsertProduct(
  product: ProductSeed,
  categoryId: string,
  sortOrder: number,
) {
  const slug = slugify(product.name);

  const record = await prisma.product.upsert({
    where: { slug },
    update: {
      price: product.price,
      offerPrice: product.offerPrice ?? null,
      categoryId,
      sortOrder,
    },
    create: {
      slug,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      price: product.price,
      offerPrice: product.offerPrice ?? null,
      prepMinutes: product.prepMinutes,
      isFeatured: product.isFeatured ?? false,
      image: product.image,
      categoryId,
      sortOrder,
      sku: slug.toUpperCase().slice(0, 24),
    },
    select: { id: true },
  });

  await prisma.productImage.deleteMany({ where: { productId: record.id } });
  await prisma.productImage.createMany({
    data: [
      { productId: record.id, url: product.image, alt: product.name, sortOrder: 0 },
    ],
  });

  if (product.tags?.length) {
    const tags = await prisma.tag.findMany({
      where: { slug: { in: product.tags.map(slugify) } },
      select: { id: true },
    });
    await prisma.productTag.createMany({
      data: tags.map((tag) => ({ productId: record.id, tagId: tag.id })),
      skipDuplicates: true,
    });
  }

  if (product.ingredients?.length) {
    const ingredients = await prisma.ingredient.findMany({
      where: { slug: { in: product.ingredients.map(slugify) } },
      select: { id: true },
    });
    await prisma.productIngredient.createMany({
      data: ingredients.map((ingredient) => ({
        productId: record.id,
        ingredientId: ingredient.id,
      })),
      skipDuplicates: true,
    });
  }

  if (product.extras?.length) {
    const extras = await prisma.extra.findMany({
      where: { slug: { in: product.extras.map(slugify) } },
      select: { id: true },
    });
    await prisma.productExtra.createMany({
      data: extras.map((extra, index) => ({
        productId: record.id,
        extraId: extra.id,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
  }

  if (product.variants?.length) {
    await prisma.variantGroup.deleteMany({ where: { productId: record.id } });
    for (const [groupIndex, group] of product.variants.entries()) {
      await prisma.variantGroup.create({
        data: {
          productId: record.id,
          name: group.name,
          sortOrder: groupIndex,
          options: {
            createMany: {
              data: group.options.map((option, optionIndex) => ({
                name: option.name,
                priceDelta: option.priceDelta,
                isDefault: option.isDefault ?? false,
                sortOrder: optionIndex,
              })),
            },
          },
        },
      });
    }
  }
}

async function seedCatalogue() {
  for (const [categoryIndex, category] of CATALOGUE.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: slugify(category.name) },
      update: { description: category.description, icon: category.icon },
      create: {
        slug: slugify(category.name),
        name: category.name,
        description: category.description,
        icon: category.icon,
        sortOrder: categoryIndex,
      },
      select: { id: true },
    });

    for (const [index, product] of (category.products ?? []).entries()) {
      await upsertProduct(product, parent.id, index);
    }

    for (const [childIndex, child] of (category.children ?? []).entries()) {
      const subcategory = await prisma.category.upsert({
        where: { slug: slugify(child.name) },
        update: { description: child.description, parentId: parent.id },
        create: {
          slug: slugify(child.name),
          name: child.name,
          description: child.description,
          parentId: parent.id,
          sortOrder: childIndex,
        },
        select: { id: true },
      });

      for (const [index, product] of child.products.entries()) {
        await upsertProduct(product, subcategory.id, index);
      }
    }
  }
}

async function seedBanners() {
  const banners = [
    {
      title: 'Cocina de origen',
      subtitle: 'Productos de temporada, técnica clásica y fuego lento.',
      image:
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2000&q=80',
      ctaLabel: 'Ver el menú',
      ctaHref: '/#menu',
      placement: BannerPlacement.HERO,
      sortOrder: 0,
    },
    {
      title: 'Delivery gratis sobre $35.000',
      subtitle: 'En Providencia, Ñuñoa y Santiago Centro.',
      image:
        'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=2000&q=80',
      ctaLabel: 'Pedir ahora',
      ctaHref: '/#menu',
      placement: BannerPlacement.MENU_TOP,
      sortOrder: 0,
    },
  ];

  for (const banner of banners) {
    const existing = await prisma.banner.findFirst({
      where: { title: banner.title },
      select: { id: true },
    });

    if (existing) {
      await prisma.banner.update({ where: { id: existing.id }, data: banner });
    } else {
      await prisma.banner.create({ data: banner });
    }
  }
}

async function seedPromotionsAndCoupons() {
  await prisma.coupon.upsert({
    where: { code: 'BIENVENIDA10' },
    update: {},
    create: {
      code: 'BIENVENIDA10',
      description: '10% de descuento en tu primer pedido',
      discountType: 'PERCENTAGE',
      value: 10,
      minSubtotal: 15000,
      maxDiscount: 6000,
      perCustomerLimit: 1,
      startsAt: new Date(),
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'ENVIOGRATIS' },
    update: {},
    create: {
      code: 'ENVIOGRATIS',
      description: 'Despacho sin costo',
      discountType: 'FIXED',
      value: 0,
      minSubtotal: 20000,
      freeDelivery: true,
      perCustomerLimit: 3,
      startsAt: new Date(),
      isActive: true,
    },
  });

  await prisma.promotion.upsert({
    where: { slug: 'martes-de-fondos' },
    update: {},
    create: {
      slug: 'martes-de-fondos',
      name: 'Martes de fondos',
      description: '15% en platos de fondo todos los martes',
      discountType: 'PERCENTAGE',
      value: 15,
      scope: 'CATEGORY',
      minSubtotal: 12000,
      maxDiscount: 8000,
      priority: 10,
      startsAt: new Date(),
      isActive: false,
    },
  });
}

async function main() {
  console.log('▸ Seeding configuration…');
  await Promise.all([seedSettings(), seedPaymentMethods(), seedBusinessHours()]);

  console.log('▸ Seeding delivery zones and taxonomy…');
  await seedCommunes();
  await seedTagsAndIngredients();
  await seedExtras();

  console.log('▸ Seeding catalogue…');
  await seedCatalogue();

  console.log('▸ Seeding banners, promotions and coupons…');
  await seedBanners();
  await seedPromotionsAndCoupons();

  const [products, categories] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
  ]);

  console.log(`\n✔ Seed complete — ${categories} categories, ${products} products.`);
}

main()
  .catch((error) => {
    console.error('✖ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
