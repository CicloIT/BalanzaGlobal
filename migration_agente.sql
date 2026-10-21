-- Agente local por sitio: la balanza puede leerse directo desde el backend (TCP)
-- o recibirse desde un agente que se conecta por WSS con un token por dispositivo.
-- Idempotente: se puede correr varias veces.
BEGIN;

ALTER TABLE configuracion_dispositivos
  ADD COLUMN IF NOT EXISTS modo_conexion varchar(10) NOT NULL DEFAULT 'directo',
  ADD COLUMN IF NOT EXISTS agente_token_hash text,
  ADD COLUMN IF NOT EXISTS agente_ultima_conexion timestamptz,
  ADD COLUMN IF NOT EXISTS agente_info jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracion_dispositivos_modo_conexion_chk') THEN
    ALTER TABLE configuracion_dispositivos
      ADD CONSTRAINT configuracion_dispositivos_modo_conexion_chk CHECK (modo_conexion IN ('directo', 'agente'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS configuracion_dispositivos_agente_token_uq
  ON configuracion_dispositivos (agente_token_hash) WHERE agente_token_hash IS NOT NULL;

COMMIT;
