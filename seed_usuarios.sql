-- Las contraseñas quedan en texto plano: después correr  node Backend/scripts/hashear_passwords.mjs
-- (igual se hashean solas en el primer login de cada usuario).
-- Roles: superadmin (lo crea migration_empresa_scope.sql), logistica y un balancero por localidad.

-- Logística global (solo dashboard, ve todas las localidades de su empresa)
INSERT INTO usuario (username, password_hash, rol, localidad_id) VALUES
  ('logistica', '123456', 'logistica', NULL);

-- Balanceros por localidad
INSERT INTO usuario (username, password_hash, rol, localidad_id) VALUES
  ('balancero_elmirador',  '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'El Mirador')),
  ('balancero_quines',     '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'Quines')),
  ('balancero_lasarita',   '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'La Sarita')),
  ('balancero_saltasj',    '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'Salta - San Jose')),
  ('balancero_saltass',    '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'Salta - San Sebastian'));
