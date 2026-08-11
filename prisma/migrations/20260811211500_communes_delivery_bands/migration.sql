-- Los sectores de despacho y sus bandas de precio sólo existían en
-- `prisma/seed.ts`, y `scripts/deploy.sh` corre `prisma migrate deploy` pero
-- nunca el seed. La migración anterior agregó `deliveryFeeMin`/`deliveryFeeMax`
-- con DEFAULT 0, así que producción quedó con las columnas creadas y vacías:
-- el código de la banda desplegado, la banda mostrando $0, los sectores nuevos
-- ausentes y dos zonas con el nombre viejo ("… hasta el retén").
--
-- Va como migración de datos y no agregando el seed al deploy a propósito. El
-- seed es un upsert que reescribe todo el catálogo en cada corrida: metido en
-- `deploy.sh` revertiría en cada despliegue lo que el operador corrija desde
-- `/admin`. Esto corre una sola vez y después no vuelve a tocar la tabla.
--
-- Los slugs se conservan: los pedidos históricos apuntan a estas filas.

INSERT INTO "communes" (
  "id",
  "name",
  "slug",
  "deliveryFee",
  "deliveryFeeMin",
  "deliveryFeeMax",
  "minOrder",
  "extraMinutes",
  "isActive",
  "sortOrder",
  "updatedAt"
)
VALUES
  -- `deliveryFee` es siempre el piso de la banda: es el único monto que entra
  -- al total, y cobrar el techo inflaría la mayoría de los pedidos.
  (gen_random_uuid()::text, 'Paine Centro', 'paine-centro', 2000, 2000, 3000, 0, 0, true, 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Viluco', 'viluco', 3000, 3000, 4500, 0, 8, true, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Colonia Kennedy', 'colonia-kennedy', 3000, 3000, 5000, 0, 10, true, 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Champa', 'champa', 3500, 3500, 5000, 0, 10, true, 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Hospital', 'hospital', 3500, 3500, 6000, 0, 12, true, 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Carretera (empresas)', 'carretera-empresas', 3500, 3500, 4500, 0, 10, true, 5, CURRENT_TIMESTAMP),
  -- Cada localidad se escribe completa en vez de "otros sectores": un cliente
  -- que no encuentra el nombre del suyo asume que no le llegamos.
  (gen_random_uuid()::text, 'Memorial, C. Las Rosas, 24 de Abril, N. Sendero, V. Hermoso, C. Santa María, C. La Masía, Huelquén Retén', 'huelquen', 3500, 3500, 7000, 0, 15, true, 6, CURRENT_TIMESTAMP),
  -- Tarifa plana: piso igual a techo, la UI imprime una sola cifra.
  (gen_random_uuid()::text, 'Linderos Plaza', 'linderos-plaza', 6000, 6000, 6000, 0, 15, true, 7, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "deliveryFee" = EXCLUDED."deliveryFee",
  "deliveryFeeMin" = EXCLUDED."deliveryFeeMin",
  "deliveryFeeMax" = EXCLUDED."deliveryFeeMax",
  "minOrder" = EXCLUDED."minOrder",
  "extraMinutes" = EXCLUDED."extraMinutes",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Se desactiva, no se borra: los pedidos pasados siguen apuntando a estas filas.
UPDATE "communes"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" NOT IN (
  'paine-centro',
  'viluco',
  'colonia-kennedy',
  'champa',
  'hospital',
  'carretera-empresas',
  'huelquen',
  'linderos-plaza'
);
