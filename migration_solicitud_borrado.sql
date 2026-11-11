-- Solicitudes de borrado de operaciones de pesaje.
-- El balancero pide borrar operaciones cerradas (con motivo): desde ese momento dejan de
-- mostrársele. El superadmin aprueba (borrado real, queda el snapshot en
-- solicitud_borrado_operacion) o rechaza (las operaciones vuelven a verse).
-- Idempotente: se puede correr varias veces.

CREATE TABLE IF NOT EXISTS solicitud_borrado (
    id serial PRIMARY KEY,
    localidad_id integer NOT NULL REFERENCES localidad(id),
    solicitado_por integer NOT NULL REFERENCES usuario(id),
    motivo text NOT NULL CHECK (btrim(motivo) <> ''),
    estado varchar(10) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resuelto_por integer REFERENCES usuario(id),
    resuelto_at timestamp without time zone,
    comentario_resolucion text
);

CREATE INDEX IF NOT EXISTS idx_solicitud_borrado_estado
    ON solicitud_borrado (estado, localidad_id);

-- Snapshot de cada operación al momento de pedir el borrado (sin FK: al aprobar se borra)
CREATE TABLE IF NOT EXISTS solicitud_borrado_operacion (
    solicitud_id integer NOT NULL REFERENCES solicitud_borrado(id) ON DELETE CASCADE,
    operacion_id integer NOT NULL,
    datos jsonb NOT NULL,
    PRIMARY KEY (solicitud_id, operacion_id)
);

-- Operación con solicitud pendiente: oculta para quien no tiene pesaje:delete
ALTER TABLE operacion_pesaje
    ADD COLUMN IF NOT EXISTS borrado_solicitud_id integer
    REFERENCES solicitud_borrado(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operacion_borrado_solicitud
    ON operacion_pesaje (borrado_solicitud_id) WHERE borrado_solicitud_id IS NOT NULL;
