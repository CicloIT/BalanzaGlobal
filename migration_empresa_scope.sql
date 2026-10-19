-- ============================================================================
-- Migración: empresa + catálogos por localidad
-- Idempotente. Correr con:  psql -v ON_ERROR_STOP=1 -d <db> -f migration_empresa_scope.sql
-- ============================================================================

-- El nuevo valor de enum debe quedar commiteado antes de usarse
ALTER TYPE rol_enum ADD VALUE IF NOT EXISTS 'superadmin';

BEGIN;

-- ─── Empresa ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresa (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL UNIQUE,
    cuit        VARCHAR(20),
    activo      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS empresa_config (
    empresa_id      INT PRIMARY KEY REFERENCES empresa(id) ON DELETE CASCADE,
    nombre_fantasia VARCHAR(150),
    logo_url        TEXT,
    color_primario  VARCHAR(20),
    modulos         JSONB NOT NULL DEFAULT '{}'::jsonb,
    parametros      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO empresa (id, nombre) VALUES (1, 'Empresa principal')
ON CONFLICT (id) DO NOTHING;
SELECT setval('empresa_id_seq', GREATEST((SELECT MAX(id) FROM empresa), 1));

INSERT INTO empresa_config (empresa_id) VALUES (1)
ON CONFLICT (empresa_id) DO NOTHING;

-- ─── localidad.empresa_id ───────────────────────────────────────────────────
ALTER TABLE localidad ADD COLUMN IF NOT EXISTS empresa_id INT REFERENCES empresa(id);
UPDATE localidad SET empresa_id = 1 WHERE empresa_id IS NULL;
ALTER TABLE localidad ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_localidad_empresa ON localidad(empresa_id);

-- ─── usuario.empresa_id ─────────────────────────────────────────────────────
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS empresa_id INT REFERENCES empresa(id);
UPDATE usuario SET empresa_id = 1 WHERE empresa_id IS NULL AND rol <> 'superadmin';
CREATE INDEX IF NOT EXISTS idx_usuario_empresa ON usuario(empresa_id);

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_empresa;
ALTER TABLE usuario ADD CONSTRAINT chk_usuario_empresa
    CHECK (rol = 'superadmin' OR empresa_id IS NOT NULL);

-- La localidad del usuario debe pertenecer a su empresa
CREATE OR REPLACE FUNCTION usuario_localidad_empresa_chk() RETURNS trigger AS $$
BEGIN
    IF NEW.localidad_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM localidad l
        WHERE l.id = NEW.localidad_id AND l.empresa_id = NEW.empresa_id
    ) THEN
        RAISE EXCEPTION 'La localidad % no pertenece a la empresa %', NEW.localidad_id, NEW.empresa_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuario_localidad_empresa ON usuario;
CREATE TRIGGER trg_usuario_localidad_empresa
    BEFORE INSERT OR UPDATE OF localidad_id, empresa_id ON usuario
    FOR EACH ROW EXECUTE FUNCTION usuario_localidad_empresa_chk();

-- Superadmin de plataforma (cambiar la contraseña después de migrar)
INSERT INTO usuario (username, password_hash, rol, localidad_id, empresa_id, activo)
VALUES ('superadmin', '123456', 'superadmin', NULL, NULL, true)
ON CONFLICT (username) DO NOTHING;

-- ─── Catálogos: localidad obligatoria ───────────────────────────────────────
-- Filas viejas sin localidad quedan en la primera localidad
UPDATE chofer     SET localidad_id = (SELECT MIN(id) FROM localidad) WHERE localidad_id IS NULL;
UPDATE vehiculo   SET localidad_id = (SELECT MIN(id) FROM localidad) WHERE localidad_id IS NULL;
UPDATE producto   SET localidad_id = (SELECT MIN(id) FROM localidad) WHERE localidad_id IS NULL;
UPDATE productor  SET localidad_id = (SELECT MIN(id) FROM localidad) WHERE localidad_id IS NULL;
UPDATE transporte SET localidad_id = (SELECT MIN(id) FROM localidad) WHERE localidad_id IS NULL;

ALTER TABLE chofer     ALTER COLUMN localidad_id SET NOT NULL;
ALTER TABLE vehiculo   ALTER COLUMN localidad_id SET NOT NULL;
ALTER TABLE producto   ALTER COLUMN localidad_id SET NOT NULL;
ALTER TABLE productor  ALTER COLUMN localidad_id SET NOT NULL;
ALTER TABLE transporte ALTER COLUMN localidad_id SET NOT NULL;

-- ─── FKs por patente (dependen de vehiculo_patente_key) ─────────────────────
ALTER TABLE operacion_pesaje DROP CONSTRAINT IF EXISTS operacion_pesaje_vehiculo_patente_fkey;
ALTER TABLE pesada           DROP CONSTRAINT IF EXISTS pesada_vehiculo_patente_fkey;
ALTER TABLE operacion_pesaje DROP CONSTRAINT IF EXISTS fk_operacion_vehiculo_loc;

-- ─── UNIQUE globales → UNIQUE por localidad ─────────────────────────────────
ALTER TABLE chofer     DROP CONSTRAINT IF EXISTS chofer_codigo_key;
ALTER TABLE chofer     DROP CONSTRAINT IF EXISTS chofer_nro_documento_key;
ALTER TABLE chofer     DROP CONSTRAINT IF EXISTS uq_chofer_nombre;
ALTER TABLE vehiculo   DROP CONSTRAINT IF EXISTS vehiculo_patente_key;
ALTER TABLE producto   DROP CONSTRAINT IF EXISTS producto_codigo_key;
ALTER TABLE producto   DROP CONSTRAINT IF EXISTS uq_producto_nombre;
ALTER TABLE productor  DROP CONSTRAINT IF EXISTS productor_codigo_key;
ALTER TABLE productor  DROP CONSTRAINT IF EXISTS uq_productor_nombre;
ALTER TABLE transporte DROP CONSTRAINT IF EXISTS transporte_codigo_key;
ALTER TABLE transporte DROP CONSTRAINT IF EXISTS uq_transporte_nombre;

ALTER TABLE chofer     DROP CONSTRAINT IF EXISTS uq_chofer_codigo_loc;
ALTER TABLE chofer     DROP CONSTRAINT IF EXISTS uq_chofer_documento_loc;
ALTER TABLE chofer     DROP CONSTRAINT IF EXISTS uq_chofer_nombre_loc;
ALTER TABLE vehiculo   DROP CONSTRAINT IF EXISTS uq_vehiculo_patente_loc;
ALTER TABLE producto   DROP CONSTRAINT IF EXISTS uq_producto_codigo_loc;
ALTER TABLE producto   DROP CONSTRAINT IF EXISTS uq_producto_nombre_loc;
ALTER TABLE productor  DROP CONSTRAINT IF EXISTS uq_productor_codigo_loc;
ALTER TABLE productor  DROP CONSTRAINT IF EXISTS uq_productor_nombre_loc;
ALTER TABLE transporte DROP CONSTRAINT IF EXISTS uq_transporte_codigo_loc;
ALTER TABLE transporte DROP CONSTRAINT IF EXISTS uq_transporte_nombre_loc;


ALTER TABLE chofer     ADD CONSTRAINT uq_chofer_codigo_loc     UNIQUE (codigo, localidad_id);
ALTER TABLE chofer     ADD CONSTRAINT uq_chofer_documento_loc  UNIQUE (nro_documento, localidad_id);
ALTER TABLE chofer     ADD CONSTRAINT uq_chofer_nombre_loc     UNIQUE (apellido_nombre, localidad_id);
ALTER TABLE vehiculo   ADD CONSTRAINT uq_vehiculo_patente_loc  UNIQUE (patente, localidad_id);
ALTER TABLE producto   ADD CONSTRAINT uq_producto_codigo_loc   UNIQUE (codigo, localidad_id);
ALTER TABLE producto   ADD CONSTRAINT uq_producto_nombre_loc   UNIQUE (nombre, localidad_id);
ALTER TABLE productor  ADD CONSTRAINT uq_productor_codigo_loc  UNIQUE (codigo, localidad_id);
ALTER TABLE productor  ADD CONSTRAINT uq_productor_nombre_loc  UNIQUE (nombre, localidad_id);
ALTER TABLE transporte ADD CONSTRAINT uq_transporte_codigo_loc UNIQUE (codigo, localidad_id);
ALTER TABLE transporte ADD CONSTRAINT uq_transporte_nombre_loc UNIQUE (nombre, localidad_id);

-- Operaciones cuyo vehículo está registrado en otra localidad:
-- se clona el vehículo en la localidad de la operación
INSERT INTO vehiculo (patente, patente_acoplado, tipo_vehiculo, activo, observaciones, localidad_id)
SELECT DISTINCT ON (op.vehiculo_patente, op.localidad_id)
       v.patente, v.patente_acoplado, v.tipo_vehiculo, v.activo, v.observaciones, op.localidad_id
FROM operacion_pesaje op
JOIN vehiculo v ON v.patente = op.vehiculo_patente
WHERE NOT EXISTS (
    SELECT 1 FROM vehiculo v2
    WHERE v2.patente = op.vehiculo_patente AND v2.localidad_id = op.localidad_id
)
ORDER BY op.vehiculo_patente, op.localidad_id, v.id;

ALTER TABLE operacion_pesaje ADD CONSTRAINT fk_operacion_vehiculo_loc
    FOREIGN KEY (vehiculo_patente, localidad_id) REFERENCES vehiculo(patente, localidad_id);

COMMIT;
