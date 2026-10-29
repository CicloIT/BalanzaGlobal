-- Grabadora: canales de los que se sacan fotos. NULL = detección automática.
-- Idempotente: se puede correr varias veces.
ALTER TABLE configuracion_dispositivos
  ADD COLUMN IF NOT EXISTS canales integer[];
