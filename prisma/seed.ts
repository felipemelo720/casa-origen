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
    // One number only: the phone in the header dials the same line that answers
    // on WhatsApp, so nobody calls a number the shop does not have.
    update: {
      logo: '/logo.png',
      phone: '+56 9 2049 9873',
      whatsapp: '+56920499873',
      deliveryEtaMinutes: 40,
    },
    create: {
      id: 'singleton',
      name: 'Casa Origen',
      logo: '/logo.png',
      tagline: 'Cocina de origen, sabor de siempre',
      description:
        'Cocina chilena contemporánea preparada con ingredientes de productores locales.',
      email: 'contacto@casaorigen.cl',
      phone: '+56 9 2049 9873',
      whatsapp: '+56920499873',
      address: 'Av. Providencia 1234, Providencia, Santiago',
      instagramUrl: 'https://instagram.com/casaorigen',
      acceptingOrders: true,
      defaultDeliveryFee: 2500,
      freeDeliveryFrom: 35000,
      minOrderAmount: 0,
      defaultPrepMinutes: 25,
      deliveryEtaMinutes: 40,
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
      code: PaymentMethodCode.TRANSFER,
      name: 'Transferencia',
      requiresChange: false,
      isActive: true,
      sortOrder: 1,
      description: 'Importante: no realices la transferencia hasta recibir nuestra confirmación.',
      instructions:
        'Después de realizar tu pedido, recibirás un mensaje por WhatsApp con el valor del despacho, total final y datos de transferencia.',
    },
    {
      code: PaymentMethodCode.CASH,
      name: 'Efectivo',
      requiresChange: true,
      isActive: true,
      sortOrder: 2,
      description: 'Paga al recibir tu pedido.',
      instructions: null,
    },
    // Los pedidos viejos apuntan a estos métodos (relación Restrict), así que
    // se desactivan en vez de borrarse.
    {
      code: PaymentMethodCode.DEBIT,
      name: 'Débito',
      requiresChange: false,
      isActive: false,
      sortOrder: 3,
      description: 'Máquina POS a domicilio.',
      instructions: null,
    },
    {
      code: PaymentMethodCode.CREDIT,
      name: 'Crédito',
      requiresChange: false,
      isActive: false,
      sortOrder: 4,
      description: 'Máquina POS a domicilio.',
      instructions: null,
    },
  ];

  for (const method of methods) {
    await prisma.paymentMethod.upsert({
      where: { code: method.code },
      update: {
        name: method.name,
        description: method.description,
        instructions: method.instructions,
        requiresChange: method.requiresChange,
        isActive: method.isActive,
        sortOrder: method.sortOrder,
      },
      create: method,
    });
  }
}

async function seedBusinessHours() {
  // Turno partido de lunes a sábado: 12:30–15:00 y 18:00–22:00. Domingo cerrado.
  // `update` repite los campos a propósito: con `update: {}` el horario nuevo
  // no llegaba a una base ya sembrada sin resetearla.
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    const isSunday = dayOfWeek === 0;
    const hours = {
      isClosed: isSunday,
      opensAt: 12 * 60 + 30,
      closesAt: 15 * 60,
      opensAt2: isSunday ? null : 18 * 60,
      closesAt2: isSunday ? null : 22 * 60,
    };

    await prisma.businessHour.upsert({
      where: { dayOfWeek },
      update: hours,
      create: { dayOfWeek, ...hours },
    });
  }
}

async function seedCommunes() {
  // Localities served inside the comuna of Paine, ordered from the town centre
  // outwards — the fee and the extra minutes both track that distance.
  // `slug` is pinned instead of derived from `name` so that rewording a
  // locality renames the existing row: deriving it would mint a second row and
  // retire the original, splitting the delivery zone in two.
  // `minOrder: 0` everywhere: there is no minimum order. It is zeroed in the
  // data instead of hidden in the UI, so `pricing.service` cannot reject a cart
  // over a threshold the storefront never showed.
  //
  // The fee is quoted as a band because it really depends on the address inside
  // the zone. `deliveryFee` is what checkout charges — the low end of the band,
  // so the total on screen is never higher than what the operator ends up
  // confirming by WhatsApp. Charging the top instead would overcharge most
  // orders; charging nothing would hide the cost until the last message.
  const communes = [
    {
      slug: 'paine-centro',
      name: 'Paine Centro',
      deliveryFeeMin: 2000,
      deliveryFeeMax: 3000,
      extraMinutes: 0,
    },
    // Renamed, not re-slugged: this is the same zone, widened past the retén.
    { slug: 'viluco', name: 'Viluco', deliveryFeeMin: 3000, deliveryFeeMax: 4500, extraMinutes: 8 },
    {
      slug: 'colonia-kennedy',
      name: 'Colonia Kennedy',
      deliveryFeeMin: 3000,
      deliveryFeeMax: 5000,
      extraMinutes: 10,
    },
    {
      slug: 'champa',
      name: 'Champa',
      deliveryFeeMin: 3500,
      deliveryFeeMax: 5000,
      extraMinutes: 10,
    },
    {
      slug: 'hospital',
      name: 'Hospital',
      deliveryFeeMin: 3500,
      deliveryFeeMax: 6000,
      extraMinutes: 12,
    },
    {
      slug: 'carretera-empresas',
      name: 'Carretera (empresas)',
      deliveryFeeMin: 3500,
      deliveryFeeMax: 4500,
      extraMinutes: 10,
    },
    // Reuses the `huelquen` slug: Huelquén Retén is inside this group, so the
    // zone was widened rather than replaced, and past orders keep pointing at a
    // row that is still active. Every locality is spelled out instead of being
    // called "otros sectores" — a customer who cannot find their own name in
    // the list assumes we do not reach them.
    {
      slug: 'huelquen',
      name: 'Memorial, C. Las Rosas, 24 de Abril, N. Sendero, V. Hermoso, C. Santa María, C. La Masía, Huelquén Retén',
      deliveryFeeMin: 3500,
      deliveryFeeMax: 7000,
      extraMinutes: 15,
    },
    // Flat, not a band: min equals max, and the UI prints one figure.
    {
      slug: 'linderos-plaza',
      name: 'Linderos Plaza',
      deliveryFeeMin: 6000,
      deliveryFeeMax: 6000,
      extraMinutes: 15,
    },
  ].map((commune) => ({ ...commune, minOrder: 0, deliveryFee: commune.deliveryFeeMin }));

  const slugs = communes.map((commune) => commune.slug);

  for (const [index, commune] of communes.entries()) {
    await prisma.commune.upsert({
      where: { slug: commune.slug },
      update: {
        name: commune.name,
        deliveryFee: commune.deliveryFee,
        deliveryFeeMin: commune.deliveryFeeMin,
        deliveryFeeMax: commune.deliveryFeeMax,
        minOrder: commune.minOrder,
        extraMinutes: commune.extraMinutes,
        sortOrder: index,
        isActive: true,
      },
      create: { ...commune, sortOrder: index },
    });
  }

  // Retire anything seeded previously. Past orders point at these rows, so they
  // are deactivated rather than deleted.
  await prisma.commune.updateMany({
    where: { slug: { notIn: slugs } },
    data: { isActive: false },
  });
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
    { name: 'Pomodoro', isAllergen: false },
    { name: 'Mozzarella', isAllergen: true },
    { name: 'Pepperoni', isAllergen: false },
    { name: 'Aceituna', isAllergen: false },
    { name: 'Tomate cherry', isAllergen: false },
    { name: 'Jamón pierna', isAllergen: false },
    { name: 'Salame', isAllergen: false },
    { name: 'Tocino', isAllergen: false },
    { name: 'Carne mechada', isAllergen: false },
    { name: 'Pimentón', isAllergen: false },
    { name: 'Cebolla morada', isAllergen: false },
    { name: 'Albahaca', isAllergen: false },
    { name: 'Champiñón', isAllergen: false },
    { name: 'Choclo', isAllergen: false },
  ];

  for (const ingredient of ingredients) {
    await prisma.ingredient.upsert({
      where: { slug: slugify(ingredient.name) },
      update: {},
      create: { ...ingredient, slug: slugify(ingredient.name) },
    });
  }
}

/** Add-on prices, straight from the carta: two tiers × two sizes.
 *
 *  |            | 24 cm  | 32 cm  |
 *  | Vegetales  |  $700  | $1.200 |
 *  | Premium    | $1.000 | $1.500 |
 *
 *  Both dimensions matter, so neither can own the number alone: the tier is a
 *  flag on the add-on (`Extra.isPremium`) and the two prices hang off the size
 *  option. */
const EXTRA_PRICE_24 = 700;
const EXTRA_PRICE_32 = 1200;
const EXTRA_PREMIUM_PRICE_24 = 1000;
const EXTRA_PREMIUM_PRICE_32 = 1500;

/** The carta's add-ons, in its own order: vegetales first, then premium.
 *
 *  `slug` is pinned instead of derived from `name` for the same reason as the
 *  communes: the carta calls it "Queso extra" and the first seed wrote "Extra
 *  queso", and deriving the slug would mint a second row and retire the
 *  original — with `order_item_extras` still pointing at it.
 *
 *  `price` is only the fallback for a product sold without sizes; what a
 *  topping really costs comes from the selected size. */
const PIZZA_EXTRAS = [
  { slug: 'cebolla-morada', name: 'Cebolla morada', isPremium: false },
  { slug: 'tomate-cherry', name: 'Tomate cherry', isPremium: false },
  { slug: 'pimenton', name: 'Pimentón', isPremium: false },
  { slug: 'aceituna', name: 'Aceituna', isPremium: false },
  { slug: 'choclo', name: 'Choclo', isPremium: false },
  { slug: 'albahaca-fresca', name: 'Albahaca fresca', isPremium: false },
  { slug: 'pepperoni', name: 'Pepperoni', isPremium: true },
  { slug: 'jamon-pierna', name: 'Jamón pierna', isPremium: true },
  { slug: 'tocino', name: 'Tocino', isPremium: true },
  { slug: 'salame', name: 'Salame', isPremium: true },
  { slug: 'champinon', name: 'Champiñón', isPremium: true },
  { slug: 'extra-queso', name: 'Queso extra', isPremium: true },
];

async function seedExtras() {
  const slugs = PIZZA_EXTRAS.map((extra) => extra.slug);

  // `Extra.name` is unique and a retired row from an older seed can be sitting
  // on a name the carta now uses ("Queso extra" lived on the dead
  // `queso-extra` while the live row was called "Extra queso"). Park the
  // squatter under a suffixed name instead of deleting it: `order_item_extras`
  // still points at it.
  for (const extra of PIZZA_EXTRAS) {
    const squatter = await prisma.extra.findUnique({
      where: { name: extra.name },
      select: { id: true, slug: true },
    });
    if (squatter && squatter.slug !== extra.slug) {
      await prisma.extra.update({
        where: { id: squatter.id },
        data: { name: `${extra.name} (retirado)`, isActive: false },
      });
    }
  }

  for (const [index, extra] of PIZZA_EXTRAS.entries()) {
    const price = extra.isPremium ? EXTRA_PREMIUM_PRICE_24 : EXTRA_PRICE_24;
    await prisma.extra.upsert({
      where: { slug: extra.slug },
      // `name`, `price` e `isPremium` se repiten en `update` porque son
      // justo los que hay que poder corregir sin resetear la base.
      update: {
        name: extra.name,
        price,
        isPremium: extra.isPremium,
        isActive: true,
        sortOrder: index,
      },
      create: {
        name: extra.name,
        slug: extra.slug,
        price,
        isPremium: extra.isPremium,
        sortOrder: index,
      },
    });
  }

  // Add-ons from the pre-carta seed (Palta extra, Pebre, Papas fritas…) are
  // retired, not deleted: `order_item_extras` points at them.
  await prisma.extra.updateMany({
    where: { slug: { notIn: slugs } },
    data: { isActive: false },
  });
}

type ProductSeed = {
  name: string;
  shortDescription: string;
  description: string;
  price: number;
  offerPrice?: number;
  prepMinutes: number;
  isFeatured?: boolean;
  /**
   * `false` deja el producto vivo y comprable pero fuera de la carta. Lo usa el
   * Combo Individual: su superficie es la card de promo, no una tarjeta más en
   * la grilla, pero sigue siendo la fila que `pricing.service` cotiza.
   */
  isVisible?: boolean;
  image: string;
  tags?: string[];
  ingredients?: string[];
  variants?: {
    name: string;
    options: {
      name: string;
      priceDelta: number;
      extraPrice?: number;
      extraPremiumPrice?: number;
      isDefault?: boolean;
    }[];
  }[];
  /** Referenced by pinned slug, not by name: see `PIZZA_EXTRAS`. */
  extras?: { slug: string }[];
};

type CategorySeed = {
  name: string;
  description: string;
  icon: string;
  children?: { name: string; description: string; products: ProductSeed[] }[];
  products?: ProductSeed[];
};

// Two sizes, and the jump to 32 cm is not the same for every pizza: the carta
// prices each pair on its own, so the delta is a per-product argument instead
// of the shared constant this used to be. Both add-on prices ride along
// because the carta charges toppings by size *and* by tier.
const pizzaSizes = (deltaTo32: number) => ({
  name: 'Tamaño',
  options: [
    {
      name: '24 cm',
      priceDelta: 0,
      extraPrice: EXTRA_PRICE_24,
      extraPremiumPrice: EXTRA_PREMIUM_PRICE_24,
      isDefault: true,
    },
    {
      name: '32 cm',
      priceDelta: deltaTo32,
      extraPrice: EXTRA_PRICE_32,
      extraPremiumPrice: EXTRA_PREMIUM_PRICE_32,
    },
  ],
});

const CATALOGUE: CategorySeed[] = [
  {
    name: 'Pizzas',
    description: 'Masa artesanal, horneadas al momento',
    icon: 'Pizza',
    products: [
      {
        name: 'Pepperoni',
        shortDescription: 'Pomodoro, mozzarella, pepperoni y aceituna',
        description: 'Pomodoro, mozzarella, pepperoni y aceituna.',
        price: 5500,
        prepMinutes: 20,
        isFeatured: true,
        image: '/menu/pepperoni.jpg',
        ingredients: ['Pomodoro', 'Mozzarella', 'Pepperoni', 'Aceituna'],
        extras: PIZZA_EXTRAS,
        variants: [pizzaSizes(4500)],
      },
      {
        name: 'Napolitana',
        shortDescription: 'Pomodoro, mozzarella, tomate cherry, jamón pierna y aceituna',
        description: 'Pomodoro, mozzarella, tomate cherry, jamón pierna y aceituna.',
        price: 6000,
        prepMinutes: 20,
        image: '/menu/napolitana.jpg',
        ingredients: ['Pomodoro', 'Mozzarella', 'Tomate cherry', 'Jamón pierna', 'Aceituna'],
        extras: PIZZA_EXTRAS,
        variants: [pizzaSizes(4000)],
      },
      {
        name: 'Tres Carnes',
        shortDescription: 'Pomodoro, mozzarella, jamón pierna, salame y tocino',
        description: 'Pomodoro, mozzarella, jamón pierna, salame y tocino.',
        price: 6500,
        prepMinutes: 22,
        isFeatured: true,
        image: '/menu/tres-carnes.jpg',
        ingredients: ['Pomodoro', 'Mozzarella', 'Jamón pierna', 'Salame', 'Tocino'],
        extras: PIZZA_EXTRAS,
        variants: [pizzaSizes(4500)],
      },
      {
        name: 'Mechada',
        shortDescription: 'Pomodoro, mozzarella, carne mechada, pimentón y cebolla morada',
        description: 'Pomodoro, mozzarella, carne mechada, pimentón y cebolla morada.',
        price: 7500,
        prepMinutes: 25,
        isFeatured: true,
        image: '/menu/mechada.jpg',
        ingredients: ['Pomodoro', 'Mozzarella', 'Carne mechada', 'Pimentón', 'Cebolla morada'],
        extras: PIZZA_EXTRAS,
        variants: [pizzaSizes(5000)],
      },
      {
        name: 'Cherry Margarita',
        shortDescription: 'Pomodoro, mozzarella, tomate cherry y albahaca',
        description: 'Pomodoro, mozzarella, tomate cherry y albahaca.',
        price: 5500,
        prepMinutes: 20,
        isFeatured: true,
        image: '/menu/cherry-margarita.jpg',
        tags: ['Vegetariano'],
        ingredients: ['Pomodoro', 'Mozzarella', 'Tomate cherry', 'Albahaca'],
        extras: PIZZA_EXTRAS,
        variants: [pizzaSizes(4500)],
      },
      {
        name: 'Rústica',
        shortDescription: 'Pomodoro, mozzarella, champiñón, salame y aceituna',
        description: 'Pomodoro, mozzarella, champiñón, salame y aceituna.',
        price: 6000,
        prepMinutes: 22,
        image: '/menu/rustica.jpg',
        ingredients: ['Pomodoro', 'Mozzarella', 'Champiñón', 'Salame', 'Aceituna'],
        extras: PIZZA_EXTRAS,
        variants: [pizzaSizes(4000)],
      },
      {
        name: 'La Huerta',
        shortDescription:
          'Pomodoro, mozzarella, champiñón, cebolla morada, pimentón, choclo y aceituna',
        description:
          'Pomodoro, mozzarella, champiñón, cebolla morada, pimentón, choclo y aceituna.',
        price: 6000,
        prepMinutes: 22,
        image: '/menu/la-huerta.jpg',
        tags: ['Vegetariano'],
        ingredients: [
          'Pomodoro',
          'Mozzarella',
          'Champiñón',
          'Cebolla morada',
          'Pimentón',
          'Choclo',
          'Aceituna',
        ],
        extras: PIZZA_EXTRAS,
        variants: [pizzaSizes(4500)],
      },
    ],
  },
  {
    name: 'Bebidas',
    description: 'Para acompañar',
    icon: 'CupSoda',
    products: [
      {
        name: 'Coca-Cola',
        shortDescription: 'Lata 350 cc',
        description: 'Lata de 350 cc, bien fría.',
        price: 1200,
        // Nothing to cook: it comes out of the fridge with the pizza.
        prepMinutes: 0,
        image: '/menu/coca-cola.jpg',
      },
      {
        name: 'Coca-Cola Zero',
        shortDescription: 'Lata 350 cc',
        description: 'Lata de 350 cc, bien fría.',
        price: 1200,
        prepMinutes: 0,
        image: '/menu/coca-cola-zero.jpg',
      },
    ],
  },
  {
    // Última y con su único producto `isVisible: false`: la categoría existe
    // para colgar el combo de algún lado, no para salir en la carta. Sin
    // productos visibles el menú no la pinta, así que la grilla sigue siendo
    // Pizzas y Bebidas.
    name: 'Promos',
    description: 'Combos armados, precio cerrado',
    icon: 'Tag',
    products: [
      {
        // Producto y no `Promotion`, a propósito. El motor de promociones cobra
        // un descuento sobre el carrito y es homogéneo: `bundle-promo.ts` exige
        // que toda unidad del bundle comparta el mismo `VariantOption.name`, y
        // una pizza y una bebida no comparten ninguno. Además `pricing.service`
        // aplica una sola promoción por pedido (`break`), así que un
        // combo-promoción se comería el slot de la Promo Dúo cuando los dos
        // caen en el mismo carrito.
        //
        // Como producto con dos grupos requeridos el precio sale del camino que
        // ya existe (`offerPrice ?? price` + deltas) sin tocar el motor, y la
        // card de la landing es sólo su superficie.
        name: 'Combo Individual',
        shortDescription: 'Pizza de 24 cm + bebida en lata 350 cc',
        description:
          'Elige una de nuestras pizzas de 24 cm seleccionadas y una bebida en lata de 350 cc. Precio cerrado, sin sorpresas.',
        // `price` es lo que costaría suelto ($6.000 + $1.200) y existe sólo como
        // ancla tachada; `offerPrice` es lo que se cobra. El par queda
        // congelado: si sube la Napolitana, el combo no se entera.
        price: 7200,
        offerPrice: 7000,
        prepMinutes: 20,
        // Fuera de la carta: se vende desde la card de promo, no como una
        // tarjeta más entre las pizzas, donde un precio sin tamaño confunde.
        isVisible: false,
        image: '/menu/napolitana.jpg',
        // Sin extras: es un precio cerrado, y habilitarlos dejaría cobrar
        // toppings sobre una base ya descontada.
        variants: [
          {
            name: 'Elige tu pizza',
            options: [
              { name: 'Napolitana', priceDelta: 0, isDefault: true },
              { name: 'Rústica', priceDelta: 0 },
              { name: 'La Huerta', priceDelta: 0 },
            ],
          },
          {
            name: 'Elige tu bebida',
            options: [
              { name: 'Coca-Cola', priceDelta: 0, isDefault: true },
              { name: 'Coca-Cola Zero', priceDelta: 0 },
            ],
          },
        ],
      },
    ],
  },
];

async function upsertProduct(product: ProductSeed, categoryId: string, sortOrder: number) {
  const slug = slugify(product.name);

  const record = await prisma.product.upsert({
    where: { slug },
    update: {
      // Everything the carta owns is repeated here: a product that survives a
      // menu change by slug (Pepperoni, Napolitana) has to pick up the new
      // copy and the new price without resetting the database. `isFeatured` is
      // deliberately absent — the admin curates it with the star toggle and a
      // re-seed must not undo that.
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      price: product.price,
      offerPrice: product.offerPrice ?? null,
      prepMinutes: product.prepMinutes,
      categoryId,
      sortOrder,
      isActive: true,
      isVisible: product.isVisible ?? true,
      image: product.image,
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
      isVisible: product.isVisible ?? true,
      image: product.image,
      categoryId,
      sortOrder,
      sku: slug.toUpperCase().slice(0, 24),
    },
    select: { id: true },
  });

  await prisma.productImage.deleteMany({ where: { productId: record.id } });
  await prisma.productImage.createMany({
    data: [{ productId: record.id, url: product.image, alt: product.name, sortOrder: 0 }],
  });

  // Cleared before re-linking, not merged: a recipe that loses an ingredient or
  // a tag has to lose it in the database too. `createMany` alone only ever adds
  // (precedent: Napolitana kept "Vegetariano" after it gained jamón pierna).
  await prisma.productTag.deleteMany({ where: { productId: record.id } });
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

  await prisma.productIngredient.deleteMany({ where: { productId: record.id } });
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

  await prisma.productExtra.deleteMany({ where: { productId: record.id } });
  if (product.extras?.length) {
    const wanted = product.extras.map((extra) => extra.slug);
    const extras = await prisma.extra.findMany({
      where: { slug: { in: wanted } },
      select: { id: true, slug: true },
    });
    // Re-sorted against the seed's own list before writing `sortOrder`:
    // `findMany` answers in whatever order Postgres feels like, so taking the
    // row index straight from it shuffled the add-ons out of carta order.
    const inCartaOrder = [...extras].sort(
      (a, b) => wanted.indexOf(a.slug) - wanted.indexOf(b.slug),
    );
    await prisma.productExtra.createMany({
      data: inCartaOrder.map((extra, index) => ({
        productId: record.id,
        extraId: extra.id,
        sortOrder: index,
      })),
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
                extraPrice: option.extraPrice ?? null,
                extraPremiumPrice: option.extraPremiumPrice ?? null,
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
      // `sortOrder` se repite en `update` porque el orden de la carta lo manda
      // este archivo: sin esto una categoría nueva no puede colarse delante de
      // las que ya existen. No hay pantalla de admin que lo cure, a diferencia
      // de `isFeatured` en productos.
      update: {
        description: category.description,
        icon: category.icon,
        sortOrder: categoryIndex,
      },
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

  // Anything seeded by an older carta is retired, not deleted: `order_items`
  // point at these rows. `isActive: false` already hides them from the menu,
  // from the highlights and from the admin list.
  const currentSlugs = CATALOGUE.flatMap((category) => [
    ...(category.products ?? []),
    ...(category.children ?? []).flatMap((child) => child.products),
  ]).map((product) => slugify(product.name));

  await prisma.product.updateMany({
    where: { slug: { notIn: currentSlugs } },
    data: { isActive: false, isVisible: false, isFeatured: false },
  });
}

async function seedBanners() {
  const banners = [
    {
      title: 'Cocina de origen',
      subtitle: 'Productos de temporada, técnica clásica y fuego lento.',
      // Foto propia (public/hero/), no Unsplash: un 404 de imagen en el hero es
      // `Runtime Error: [object Event]` sin stack. Es vertical, así que el marco
      // del hero es cuadrado y recorta arriba y abajo por igual.
      image: '/hero/margarita.jpg',
      ctaLabel: 'Ver el menú',
      ctaHref: '/#menu',
      placement: BannerPlacement.HERO,
      sortOrder: 0,
    },
    // Sin banner MENU_TOP: no hay sección que lo renderice y el único que había
    // apuntaba a Unsplash, que se cae sin aviso. Un 404 de imagen es
    // `Runtime Error: [object Event]` sin stack. Todo asset va en `public/`.
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
    // Retired: the welcome discount is not offered. Kept as a row because
    // `coupon_redemptions` could reference it; reactivating is a flag.
    update: { isActive: false, isPublic: false },
    create: {
      code: 'BIENVENIDA10',
      description: '10% de descuento en tu primer pedido',
      discountType: 'PERCENTAGE',
      value: 10,
      minSubtotal: 15000,
      maxDiscount: 6000,
      perCustomerLimit: 1,
      startsAt: new Date(),
      isActive: false,
      isPublic: false,
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

  // Promo Dúo: dos pizzas de 32 cm por $17.990. `scope: CATEGORY` sobre pizzas
  // y no una lista de productos: la única variante llamada "32 cm" vive en las
  // pizzas, así que el filtro de tamaño ya acota el set, y una pizza nueva
  // entra a la promo sin tocar el seed. Para dejar una afuera (la Mechada es
  // la que más margen regala: el par vale $25.000), se cambia `scope` a
  // PRODUCT y se listan las que sí entran en `promotion_products`.
  const pizzas = await prisma.category.findUnique({
    where: { slug: 'pizzas' },
    select: { id: true },
  });

  const duo = {
    name: 'Promo Dúo',
    description: 'Dos pizzas de 32 cm por un solo precio.',
    discountType: 'BUNDLE_PRICE',
    value: 17990,
    scope: 'CATEGORY',
    bundleSize: 2,
    bundleVariantName: '32 cm',
    bundleSizeLabel: '32 cm',
    isFeatured: true,
    // Foto propia. El flyer original trae el precio quemado en el JPG: sirve
    // para Instagram y no para la landing, donde el precio lo pinta el server
    // y tiene que seguir siendo legible en dark mode y a 360px.
    image: '/hero/margarita.jpg',
    priority: 20,
    isActive: true,
  } as const;

  await prisma.promotion.upsert({
    where: { slug: 'promo-duo' },
    // Repetido en `update` porque es el precio de la promo: el operador tiene
    // que poder corregirlo con un seed y sin resetear la base.
    update: {
      ...duo,
      categories: pizzas ? { deleteMany: {}, create: [{ categoryId: pizzas.id }] } : undefined,
    },
    create: {
      slug: 'promo-duo',
      ...duo,
      startsAt: new Date(),
      categories: pizzas ? { create: [{ categoryId: pizzas.id }] } : undefined,
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
