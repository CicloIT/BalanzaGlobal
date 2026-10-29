-- Módulo de cámaras por localidad (va según el plan contratado). Apagado por defecto:
-- lo habilita el superadmin desde Configuración de Dispositivos.
-- Idempotente: se puede correr varias veces.
ALTER TABLE localidad
  ADD COLUMN IF NOT EXISTS modulo_camaras boolean NOT NULL DEFAULT false;
