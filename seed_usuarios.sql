-- Admin global
INSERT INTO usuario (username, password_hash, rol, localidad_id) VALUES
  ('admin', '123456', 'admin', NULL);

-- Logistica global (solo lectura, ve todas las localidades)
INSERT INTO usuario (username, password_hash, rol, localidad_id) VALUES
  ('logistica', '123456', 'logistica', NULL);

-- Admins por localidad
INSERT INTO usuario (username, password_hash, rol, localidad_id) VALUES
  ('admin_elmirador',  '123456', 'admin', (SELECT id FROM localidad WHERE nombre = 'El Mirador')),
  ('admin_quines',     '123456', 'admin', (SELECT id FROM localidad WHERE nombre = 'Quines')),
  ('admin_lasarita',   '123456', 'admin', (SELECT id FROM localidad WHERE nombre = 'La Sarita')),
  ('admin_saltasj',    '123456', 'admin', (SELECT id FROM localidad WHERE nombre = 'Salta - San Jose')),
  ('admin_saltass',    '123456', 'admin', (SELECT id FROM localidad WHERE nombre = 'Salta - San Sebastian'));

-- Gerentes por localidad
INSERT INTO usuario (username, password_hash, rol, localidad_id) VALUES
  ('gerente_elmirador',  '123456', 'gerente', (SELECT id FROM localidad WHERE nombre = 'El Mirador')),
  ('gerente_quines',     '123456', 'gerente', (SELECT id FROM localidad WHERE nombre = 'Quines')),
  ('gerente_lasarita',   '123456', 'gerente', (SELECT id FROM localidad WHERE nombre = 'La Sarita')),
  ('gerente_saltasj',    '123456', 'gerente', (SELECT id FROM localidad WHERE nombre = 'Salta - San Jose')),
  ('gerente_saltass',    '123456', 'gerente', (SELECT id FROM localidad WHERE nombre = 'Salta - San Sebastian'));

-- Balanceros por localidad
INSERT INTO usuario (username, password_hash, rol, localidad_id) VALUES
  ('balancero_elmirador',  '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'El Mirador')),
  ('balancero_quines',     '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'Quines')),
  ('balancero_lasarita',   '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'La Sarita')),
  ('balancero_saltasj',    '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'Salta - San Jose')),
  ('balancero_saltass',    '123456', 'balancero', (SELECT id FROM localidad WHERE nombre = 'Salta - San Sebastian'));

-- Subalanceros por localidad
INSERT INTO usuario (username, password_hash, rol, localidad_id) VALUES
  ('subalancero_elmirador',  '123456', 'subalancero', (SELECT id FROM localidad WHERE nombre = 'El Mirador')),
  ('subalancero_quines',     '123456', 'subalancero', (SELECT id FROM localidad WHERE nombre = 'Quines')),
  ('subalancero_lasarita',   '123456', 'subalancero', (SELECT id FROM localidad WHERE nombre = 'La Sarita')),
  ('subalancero_saltasj',    '123456', 'subalancero', (SELECT id FROM localidad WHERE nombre = 'Salta - San Jose')),
  ('subalancero_saltass',    '123456', 'subalancero', (SELECT id FROM localidad WHERE nombre = 'Salta - San Sebastian'));
