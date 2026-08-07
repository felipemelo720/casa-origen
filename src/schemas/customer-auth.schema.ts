import { z } from 'zod';

/**
 * Credentials for customer accounts. Shared by the client form and the server
 * action, so the rule that rejects a short password lives in one place.
 */
const email = z.string().min(1, 'Ingresa tu correo.').email('Ingresa un correo válido.').max(254);

// 8 characters, no symbol/uppercase theatre: composition rules push people
// toward `Pizza123!` and this guards a pizza order history, not a bank.
const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña es demasiado larga.');

export const registerSchema = z.object({
  firstName: z.string().min(2, 'Ingresa tu nombre.').max(60),
  lastName: z.string().min(2, 'Ingresa tu apellido.').max(60),
  email,
  phone: z
    .string()
    .min(8, 'Ingresa tu teléfono.')
    .max(20)
    .regex(/^[\d+\s()-]+$/, 'Ingresa un teléfono válido.'),
  password,
});

export const loginSchema = z.object({ email, password });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
