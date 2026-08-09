import { prisma } from '@/lib/db/prisma';

/**
 * Ids del catálogo sembrado. Se leen de la base en vez de hardcodearse: los
 * ids son `cuid()`, cambian en cada siembra, y un test que los invente estaría
 * probando otra cosa.
 */
export type CatalogFixture = {
  productId: string;
  /** Pepperoni 24 cm: $5.500. */
  price24: number;
  /** Pepperoni 32 cm: $10.000 (base + delta). */
  price32: number;
  size32OptionId: string;
  transferPaymentMethodId: string;
  communeId: string;
};

export async function loadCatalogFixture(): Promise<CatalogFixture> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { slug: 'pepperoni' },
    include: { variantGroups: { include: { options: true } } },
  });

  const sizes = product.variantGroups[0];
  const size32 = sizes?.options.find((option) => option.name === '32 cm');
  if (!size32) throw new Error('El seed no dejó la opción «32 cm» en Pepperoni.');

  const transfer = await prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'TRANSFER' } });
  const commune = await prisma.commune.findUniqueOrThrow({ where: { slug: 'paine-centro' } });

  return {
    productId: product.id,
    price24: product.price,
    price32: product.price + size32.priceDelta,
    size32OptionId: size32.id,
    transferPaymentMethodId: transfer.id,
    communeId: commune.id,
  };
}
