import { describe, expect, it, vi } from 'vitest';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

import { notifyCartFull } from './cart-limits';
import { MAX_CART_LINES } from '@/schemas/cart.schema';

describe('notifyCartFull', () => {
  it('shows a single error toast', () => {
    notifyCartFull();
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('names the same cap the server enforces (MAX_CART_LINES), not a hardcoded number', () => {
    notifyCartFull();
    const [, options] = toastError.mock.calls[0] as [string, { description: string }];
    expect(options.description).toContain(String(MAX_CART_LINES));
  });

  it('tells the shopper what to do next, not just that it is full', () => {
    notifyCartFull();
    const [title, options] = toastError.mock.calls[0] as [string, { description: string }];
    expect(title).toBe('El carrito está lleno');
    expect(options.description).toMatch(/confirma|quita/i);
  });
});
