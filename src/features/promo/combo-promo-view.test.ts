import { describe, expect, it } from 'vitest';

import {
  buildComboPromoView,
  comboTotal,
  type ComboPromoChoice,
  type ComboPromoView,
} from './combo-promo-view';
import type { ProductDetail } from '@/server/repositories/product.repository';

/** The hidden combo product: a price plus one required group per decision. */
function combo(
  overrides: Partial<{
    price: number;
    offerPrice: number | null;
    availability: string;
    groups: { id: string; name: string; options: unknown[] }[];
  }> = {},
) {
  return {
    id: 'combo-individual',
    name: 'Combo Individual',
    description: 'Pizza de 24 cm + bebida en lata 350 cc.',
    image: '/menu/napolitana.jpg',
    price: overrides.price ?? 7200,
    offerPrice: overrides.offerPrice === undefined ? 7000 : overrides.offerPrice,
    availability: overrides.availability ?? 'AVAILABLE',
    category: { id: 'cat-promos', name: 'Promos', slug: 'promos', sortOrder: 2 },
    variantGroups: overrides.groups ?? [
      {
        id: 'group-pizza',
        name: 'Elige tu pizza',
        options: [
          {
            id: 'opt-napolitana',
            name: 'Napolitana',
            priceDelta: 0,
            extraPrice: 700,
            extraPremiumPrice: 1000,
            isAvailable: true,
          },
          {
            id: 'opt-rustica',
            name: 'Rústica',
            priceDelta: 0,
            extraPrice: 700,
            extraPremiumPrice: 1000,
            isAvailable: true,
          },
        ],
      },
      {
        id: 'group-drink',
        name: 'Elige tu bebida',
        options: [
          {
            id: 'opt-coca',
            name: 'Coca-Cola',
            priceDelta: 0,
            extraPrice: null,
            extraPremiumPrice: null,
            isAvailable: true,
          },
        ],
      },
    ],
  } as unknown as ProductDetail;
}

/** A catalogue product the combo borrows a photo and availability from. */
function menuItem(name: string, overrides: Partial<{ availability: string }> = {}) {
  return {
    id: `product-${name}`,
    name,
    shortDescription: `Descripción de ${name}`,
    image: `/menu/${name}.jpg`,
    price: 6000,
    offerPrice: null,
    availability: overrides.availability ?? 'AVAILABLE',
    category: { id: 'cat', name: 'Pizzas', slug: 'pizzas', sortOrder: 0 },
    variantGroups: [],
  } as unknown as ProductDetail;
}

const MENU = [menuItem('Napolitana'), menuItem('Rústica'), menuItem('Coca-Cola')];

describe('buildComboPromoView', () => {
  it('returns null without a combo product', () => {
    expect(buildComboPromoView(null, MENU)).toBeNull();
  });

  it('returns null when the combo product is sold out', () => {
    expect(buildComboPromoView(combo({ availability: 'OUT_OF_STOCK' }), MENU)).toBeNull();
  });

  it('returns null when the combo has no groups to pick from', () => {
    expect(buildComboPromoView(combo({ groups: [] }), MENU)).toBeNull();
  });

  it('maps every group and choice', () => {
    const view = buildComboPromoView(combo(), MENU);

    expect(view?.groups.map((group) => group.name)).toEqual(['Elige tu pizza', 'Elige tu bebida']);
    expect(view?.groups[0]?.choices.map((choice) => choice.name)).toEqual([
      'Napolitana',
      'Rústica',
    ]);
  });

  it('charges the offer price and anchors against the list price', () => {
    const view = buildComboPromoView(combo(), MENU);

    expect(view?.price).toBe(7000);
    expect(view?.regularPrice).toBe(7200);
  });

  it('falls back to the list price when there is no offer', () => {
    const view = buildComboPromoView(combo({ offerPrice: null }), MENU);

    // No offer means no savings pill: card and sheet both read `regularPrice`
    // minus `price`, so the two have to collapse to zero and not to a negative.
    expect(view?.price).toBe(7200);
    expect(view?.regularPrice).toBe(7200);
    expect(Math.max(0, (view?.regularPrice ?? 0) - (view?.price ?? 0))).toBe(0);
  });

  it('borrows the photo and the description from the catalogue product', () => {
    const view = buildComboPromoView(combo(), MENU);
    const napolitana = view?.groups[0]?.choices[0];

    expect(napolitana?.image).toBe('/menu/Napolitana.jpg');
    expect(napolitana?.shortDescription).toBe('Descripción de Napolitana');
  });

  it('leaves the photo empty when no catalogue product matches the option name', () => {
    const view = buildComboPromoView(combo(), [menuItem('Rústica'), menuItem('Coca-Cola')]);
    const napolitana = view?.groups[0]?.choices[0];

    // Still offered — an option with no matching product is a naming drift, not
    // a reason to hide a pizza the combo does include.
    expect(napolitana?.image).toBeNull();
    expect(napolitana?.available).toBe(true);
  });

  it('carries the add-on tiers of the flavour into the view', () => {
    // El builder los copia a la línea del carrito: sin esto el drawer no sabe
    // a cuánto cotizar un tocino sobre un combo y cae al precio de catálogo.
    const view = buildComboPromoView(combo(), MENU);
    const napolitana = view?.groups[0]?.choices[0];

    expect(napolitana?.extraPrice).toBe(700);
    expect(napolitana?.extraPremiumPrice).toBe(1000);
  });

  it('leaves the drink without add-on tiers', () => {
    // Si la bebida tarifara toppings competiría con el sabor por decidir el
    // tramo, y `pricing.service` se queda con la última opción que los trae.
    const view = buildComboPromoView(combo(), MENU);
    const coca = view?.groups[1]?.choices[0];

    expect(coca?.extraPrice).toBeNull();
    expect(coca?.extraPremiumPrice).toBeNull();
  });

  it('marks a choice unavailable when the catalogue product is sold out', () => {
    const view = buildComboPromoView(combo(), [
      menuItem('Napolitana', { availability: 'OUT_OF_STOCK' }),
      menuItem('Rústica'),
      menuItem('Coca-Cola'),
    ]);

    expect(view?.groups[0]?.choices[0]?.available).toBe(false);
    expect(view?.groups[0]?.choices[1]?.available).toBe(true);
  });

  it('marks a choice unavailable when the option row itself is switched off', () => {
    const view = buildComboPromoView(
      combo({
        groups: [
          {
            id: 'group-pizza',
            name: 'Elige tu pizza',
            options: [
              { id: 'opt-napolitana', name: 'Napolitana', priceDelta: 0, isAvailable: false },
              { id: 'opt-rustica', name: 'Rústica', priceDelta: 0, isAvailable: true },
            ],
          },
          {
            id: 'group-drink',
            name: 'Elige tu bebida',
            options: [{ id: 'opt-coca', name: 'Coca-Cola', priceDelta: 0, isAvailable: true }],
          },
        ],
      }),
      MENU,
    );

    expect(view?.groups[0]?.choices[0]?.available).toBe(false);
  });

  it('returns null when a whole group is unavailable', () => {
    // Every group is a required decision, so a picker where the drinks are all
    // sold out cannot produce a combo — better no card than a dead end.
    const view = buildComboPromoView(combo(), [
      menuItem('Napolitana'),
      menuItem('Rústica'),
      menuItem('Coca-Cola', { availability: 'OUT_OF_STOCK' }),
    ]);

    expect(view).toBeNull();
  });

  it('keeps the card alive when only some choices in a group are sold out', () => {
    const view = buildComboPromoView(combo(), [
      menuItem('Napolitana', { availability: 'OUT_OF_STOCK' }),
      menuItem('Rústica'),
      menuItem('Coca-Cola'),
    ]);

    expect(view).not.toBeNull();
  });
});

describe('comboTotal', () => {
  const view = buildComboPromoView(combo(), MENU) as ComboPromoView;

  /** First choice of every group — what a customer tapping straight down picks. */
  function firstOfEach(target: ComboPromoView): ComboPromoChoice[] {
    return target.groups.flatMap((group) => group.choices.slice(0, 1));
  }

  it('is the combo price when every delta is zero', () => {
    expect(comboTotal(view, firstOfEach(view))).toBe(7000);
  });

  it('is the combo price alone before anything is picked', () => {
    expect(comboTotal(view, [])).toBe(7000);
  });

  it('adds the deltas of the picked options', () => {
    // Mirrors `pricing.service`: `offerPrice ?? price` plus every picked delta.
    // Today every combo delta is 0, but the day the operator charges more for a
    // premium flavour the sheet has to move with the server.
    const withDelta: ComboPromoView = {
      ...view,
      groups: view.groups.map((group, index) =>
        index === 0
          ? { ...group, choices: group.choices.map((c) => ({ ...c, priceDelta: 900 })) }
          : group,
      ),
    };

    expect(comboTotal(withDelta, firstOfEach(withDelta))).toBe(7900);
  });
});
