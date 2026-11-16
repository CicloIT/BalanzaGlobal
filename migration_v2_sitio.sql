-- v2 "local-first": cada localidad puede correr su propio servidor (modo sitio) que
-- replica al central. Se aplica en el CENTRAL y en cada SITIO (mismo archivo).
-- Idempotente: se puede correr varias veces.
--
-- Dueños de los datos:
--   sitio   → chofer, vehiculo, producto, productor, transporte, operacion_pesaje, pesada,
--             reporte, solicitud_borrado, solicitud_borrado_operacion (+ capturas/documentos)
--   central → provincia, empresa, empresa_config, localidad, usuario, configuracion_dispositivos
--
-- IDs sin colisión: en un sitio, las secuencias de sus tablas usan el rango
-- [localidad_id * 10.000.000, +9.999.999] (lo fija sync_activar_sitio()). En el central
-- esas secuencias quedan limitadas a 9.999.999.

-- ─── Central: localidades con servidor propio ────────────────────────────────
ALTER TABLE localidad ADD COLUMN IF NOT EXISTS sitio_activo boolean NOT NULL DEFAULT false;
ALTER TABLE localidad ADD COLUMN IF NOT EXISTS sitio_token_hash text;
ALTER TABLE localidad ADD COLUMN IF NOT EXISTS sitio_ultima_sync timestamptz;
ALTER TABLE localidad ADD COLUMN IF NOT EXISTS sitio_info jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS localidad_sitio_token_uq
    ON localidad (sitio_token_hash) WHERE sitio_token_hash IS NOT NULL;

-- ─── Unicidades por localidad (las réplicas de varios sitios conviven en el central) ─
ALTER TABLE reporte DROP CONSTRAINT IF EXISTS reporte_numero_reporte_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_reporte_numero_loc ON reporte (localidad_id, numero_reporte);

DROP INDEX IF EXISTS unica_operacion_abierta_por_camion;
CREATE UNIQUE INDEX IF NOT EXISTS unica_operacion_abierta_por_camion_loc
    ON operacion_pesaje (vehiculo_patente, localidad_id) WHERE abierta = true;

DROP INDEX IF EXISTS uq_chofer_cuit;
CREATE UNIQUE INDEX IF NOT EXISTS uq_chofer_cuit_loc
    ON chofer (cuit, localidad_id) WHERE cuit IS NOT NULL;

-- ─── Sitio: cambios pendientes de subir y estado de la sincronización ────────
CREATE TABLE IF NOT EXISTS sync_outbox (
    id bigserial PRIMARY KEY,
    tabla text NOT NULL,
    op char(1) NOT NULL CHECK (op IN ('I', 'U', 'D')),
    pk jsonb NOT NULL,
    fila jsonb,                                   -- estado de la fila (NULL en 'D')
    creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_estado (
    clave text PRIMARY KEY,
    valor jsonb,
    actualizado timestamptz NOT NULL DEFAULT now()
);

-- Trigger genérico: guarda el estado de la fila en el outbox (solo se instala en sitios)
CREATE OR REPLACE FUNCTION sync_registrar() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    v_fila jsonb;
    v_pk jsonb;
BEGIN
    v_fila := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    IF TG_TABLE_NAME = 'solicitud_borrado_operacion' THEN
        v_pk := jsonb_build_object('solicitud_id', v_fila->'solicitud_id', 'operacion_id', v_fila->'operacion_id');
    ELSE
        v_pk := jsonb_build_object('id', v_fila->'id');
    END IF;
    INSERT INTO sync_outbox (tabla, op, pk, fila)
    VALUES (TG_TABLE_NAME, left(TG_OP, 1), v_pk, CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_fila END);
    RETURN NULL;
END;
$$;

-- Tablas cuyo dueño es el sitio, en orden de dependencias (padres primero)
CREATE OR REPLACE FUNCTION sync_tablas_sitio() RETURNS text[]
    LANGUAGE sql IMMUTABLE AS $$
    SELECT ARRAY['chofer', 'vehiculo', 'producto', 'productor', 'transporte',
                 'solicitud_borrado', 'operacion_pesaje', 'pesada',
                 'solicitud_borrado_operacion', 'reporte'];
$$;

-- Convierte esta base en la de un sitio: triggers de outbox + secuencias en el rango de la localidad.
-- La llama Backend/scripts/sitio_bootstrap.mjs después de cargar los datos iniciales.
CREATE OR REPLACE FUNCTION sync_activar_sitio(p_localidad integer) RETURNS void
    LANGUAGE plpgsql AS $$
DECLARE
    t text;
    seq text;
    base bigint := p_localidad::bigint * 10000000;
    actual bigint;
BEGIN
    IF p_localidad IS NULL OR p_localidad < 1 OR p_localidad > 213 THEN
        RAISE EXCEPTION 'localidad % fuera del rango soportado (1..213)', p_localidad;
    END IF;
    FOREACH t IN ARRAY sync_tablas_sitio() LOOP
        -- "aa_" para que dispare ANTES que trg_calcular_neto (los AFTER van por nombre):
        -- así el INSERT queda en el outbox antes que los UPDATE que hace ese trigger.
        EXECUTE format('DROP TRIGGER IF EXISTS aa_sync_outbox ON %I', t);
        EXECUTE format('CREATE TRIGGER aa_sync_outbox AFTER INSERT OR UPDATE OR DELETE ON %I
                        FOR EACH ROW EXECUTE FUNCTION sync_registrar()', t);
        seq := CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                                 WHERE table_schema = 'public' AND table_name = t AND column_name = 'id')
                    THEN pg_get_serial_sequence(t, 'id') END;
        CONTINUE WHEN seq IS NULL;
        EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I WHERE id BETWEEN $1 AND $2', t)
            INTO actual USING base, base + 9999999;
        EXECUTE format('ALTER SEQUENCE %s MINVALUE 1 MAXVALUE %s', seq, base + 9999999);
        PERFORM setval(seq, GREATEST(base, actual), true);
    END LOOP;
    -- numero_reporte se calcula por localidad en reporteController (no usa la secuencia)
    INSERT INTO sync_estado (clave, valor) VALUES ('modo', jsonb_build_object('modo', 'sitio', 'localidad_id', p_localidad))
    ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = now();
END;
$$;

-- Central (o base todavía no activada como sitio): secuencias de tablas del sitio hasta 9.999.999
DO $$
DECLARE
    t text;
    seq text;
BEGIN
    IF EXISTS (SELECT 1 FROM sync_estado WHERE clave = 'modo') THEN
        RETURN;   -- ya es un sitio: sus secuencias tienen su propio rango
    END IF;
    FOREACH t IN ARRAY sync_tablas_sitio() LOOP
        seq := CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                                 WHERE table_schema = 'public' AND table_name = t AND column_name = 'id')
                    THEN pg_get_serial_sequence(t, 'id') END;
        CONTINUE WHEN seq IS NULL;
        EXECUTE format('ALTER SEQUENCE %s MAXVALUE 9999999', seq);
    END LOOP;
END;
$$;
