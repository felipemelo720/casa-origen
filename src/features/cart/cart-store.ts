import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

export type CartVariantSelection = {
  groupId: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
  /** Add-on price while this option is picked, so the cart can price a new
   *  add-on without going back to the catalogue. `null` on lines saved before
   *  this existed; the drawer then falls back to the extra's own price. */
  extraPrice?: number | null;
};
export type CartExtraSelection = { extraId: string; name: string; unitPrice: number; quantity: number };

export type CartLine = {
  cartItemId: string;
  productId: string;
  name: string;
  image: string | null;
  basePrice: number;
  quantity: number;
  variants: CartVariantSelection[];
  extras: CartExtraSelection[];
  removedIngredientIds: string[];
  removedIngredientNames: string[];
  notes?: string;
};

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  couponCode?: string;
  orderType: 'DELIVERY' | 'PICKUP';
  communeId?: string;

  open: () => void;
  close: () => void;
  toggle: () => void;

  addLine: (line: Omit<CartLine, 'cartItemId'>) => void;
  removeLine: (cartItemId: string) => void;
  setQuantity: (cartItemId: string, quantity: number) => void;
  setLineExtras: (cartItemId: string, extras: CartExtraSelection[]) => void;
  clear: () => void;

  setCoupon: (code?: string) => void;
  setOrderType: (type: 'DELIVERY' | 'PICKUP') => void;
  setCommune: (communeId?: string) => void;
};

/** Client-side line total; the server recomputes this authoritatively at checkout. */
export function estimateLineTotal(line: CartLine): number {
  const variantsDelta = line.variants.reduce((sum, v) => sum + v.priceDelta, 0);
  const extrasTotal = line.extras.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);
  return (line.basePrice + variantsDelta) * line.quantity + extrasTotal * line.quantity;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      orderType: 'DELIVERY',

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),

      addLine: (line) =>
        set((state) => ({
          lines: [...state.lines, { ...line, cartItemId: nanoid(10) }],
          isOpen: true,
        })),

      removeLine: (cartItemId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.cartItemId !== cartItemId) })),

      setQuantity: (cartItemId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.cartItemId !== cartItemId)
              : state.lines.map((l) => (l.cartItemId === cartItemId ? { ...l, quantity } : l)),
        })),

      setLineExtras: (cartItemId, extras) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.cartItemId === cartItemId ? { ...l, extras } : l)),
        })),

      clear: () => set({ lines: [], couponCode: undefined }),

      setCoupon: (couponCode) => set({ couponCode }),
      setOrderType: (orderType) => set({ orderType }),
      setCommune: (communeId) => set({ communeId }),
    }),
    { name: 'casa-origen-cart', version: 1 },
  ),
);

export function useCartCount(): number {
  return useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));
}

export function useCartSubtotal(): number {
  return useCartStore((state) => state.lines.reduce((sum, line) => sum + estimateLineTotal(line), 0));
}

/** Maps a persisted cart line back into the selection-only payload the server accepts. */
export function toCartItemInput(line: CartLine) {
  return {
    cartItemId: line.cartItemId,
    productId: line.productId,
    quantity: line.quantity,
    selectedVariantOptionIds: line.variants.map((v) => v.optionId),
    selectedExtras: line.extras.map((e) => ({ extraId: e.extraId, quantity: e.quantity })),
    removedIngredientIds: line.removedIngredientIds,
    notes: line.notes,
  };
}
