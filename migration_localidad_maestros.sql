-- Agregar localidad_id a tablas maestro
ALTER TABLE chofer     ADD COLUMN IF NOT EXISTS localidad_id INT REFERENCES localidad(id);
ALTER TABLE producto   ADD COLUMN IF NOT EXISTS localidad_id INT REFERENCES localidad(id);
ALTER TABLE productor  ADD COLUMN IF NOT EXISTS localidad_id INT REFERENCES localidad(id);
ALTER TABLE transporte ADD COLUMN IF NOT EXISTS localidad_id INT REFERENCES localidad(id);
ALTER TABLE vehiculo   ADD COLUMN IF NOT EXISTS localidad_id INT REFERENCES localidad(id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chofer_localidad     ON chofer(localidad_id);
CREATE INDEX IF NOT EXISTS idx_producto_localidad   ON producto(localidad_id);
CREATE INDEX IF NOT EXISTS idx_productor_localidad  ON productor(localidad_id);
CREATE INDEX IF NOT EXISTS idx_transporte_localidad ON transporte(localidad_id);
CREATE INDEX IF NOT EXISTS idx_vehiculo_localidad   ON vehiculo(localidad_id);
