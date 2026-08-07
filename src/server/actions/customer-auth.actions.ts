'use server';

import { z } from 'zod';

import { publicAction } from '@/server/actions/action-builder';
import { loginSchema, registerSchema } from '@/schemas/customer-auth.schema';
import {
  getCurrentCustomer,
  loginCustomer,
  registerCustomer,
} from '@/server/services/customer-auth.service';
import { clearCustomerSession } from '@/lib/auth/customer-session';

export const registerCustomerAction = publicAction(
  { name: 'customer.register', rateLimit: { limit: 5, windowMs: 60_000 } },
  registerSchema,
  async (input) => registerCustomer(input),
);

// Tighter bucket than register: this is the endpoint worth brute-forcing.
export const loginCustomerAction = publicAction(
  { name: 'customer.login', rateLimit: { limit: 10, windowMs: 60_000 } },
  loginSchema,
  async (input) => loginCustomer(input),
);

export const logoutCustomerAction = publicAction(
  { name: 'customer.logout' },
  z.void(),
  async () => {
    await clearCustomerSession();
    return null;
  },
);

/** Lets a client component read the session without prop-drilling it. */
export const getCurrentCustomerAction = publicAction(
  { name: 'customer.current', rateLimit: { limit: 60, windowMs: 60_000 } },
  z.void(),
  async () => getCurrentCustomer(),
);
