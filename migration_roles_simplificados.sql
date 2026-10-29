-- Roles simplificados: superadmin (único admin), logistica (solo dashboard, todas las localidades)
-- y balancero (uno por localidad). Los usuarios admin, gerente y subalancero se desactivan
-- (no se borran: conservan su historial). Los usuarios de prueba u_TST* también.
-- Los valores siguen en el enum rol_enum; en el código esos roles ya no tienen permisos.
-- Idempotente: se puede correr varias veces.
UPDATE usuario SET activo = false, updated_at = CURRENT_TIMESTAMP
WHERE activo = true
  AND (rol::text IN ('admin', 'gerente', 'subalancero') OR username LIKE 'u\_TST%');
