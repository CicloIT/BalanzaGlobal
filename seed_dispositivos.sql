-- Eliminar constraint viejo si existe (nombre puede variar)
DO $$
BEGIN
  ALTER TABLE configuracion_dispositivos
    DROP CONSTRAINT IF EXISTS configuracion_dispositivo_tipo_dispositivo_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Agregar constraint por (tipo_dispositivo, localidad_id) si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configuracion_dispositivo_tipo_localidad_key'
  ) THEN
    ALTER TABLE configuracion_dispositivos
      ADD CONSTRAINT configuracion_dispositivo_tipo_localidad_key
      UNIQUE (tipo_dispositivo, localidad_id);
  END IF;
END $$;

-- Limpiar filas previas
DELETE FROM configuracion_dispositivos;

-- Una fila de balanza por localidad
INSERT INTO configuracion_dispositivos (tipo_dispositivo, ip, puerto, usuario, contraseña, activo, marca, localidad_id)
SELECT 'balanza', '127.0.0.1', NULL, NULL, NULL, true, NULL, id
FROM localidad;

-- Una fila de grabadora por localidad (cambiar marca a 'dahua' si corresponde)
INSERT INTO configuracion_dispositivos (tipo_dispositivo, ip, puerto, usuario, contraseña, activo, marca, localidad_id)
SELECT 'grabadora', '127.0.0.1', NULL, 'admin', 'admin', true, 'hikvision', id
FROM localidad;
