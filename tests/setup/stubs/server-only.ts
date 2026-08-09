// `server-only` existe para romper el build cuando un módulo de servidor entra
// al bundle del cliente. En vitest no hay bundle de cliente y el paquete real
// tira. Se alias a este módulo vacío en `vitest.integration.config.ts`, así
// ningún test tiene que repetir `vi.mock('server-only')` archivo por archivo.
export {};
