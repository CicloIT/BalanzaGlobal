INSERT INTO provincia (nombre) VALUES
  ('San Luis'),
  ('Salta')
RETURNING id, nombre;

INSERT INTO localidad (nombre, provincia_id) VALUES
  ('El Mirador',            (SELECT id FROM provincia WHERE nombre = 'San Luis')),
  ('Quines',                (SELECT id FROM provincia WHERE nombre = 'San Luis')),
  ('La Sarita',             (SELECT id FROM provincia WHERE nombre = 'San Luis')),
  ('Salta - San Jose',      (SELECT id FROM provincia WHERE nombre = 'Salta')),
  ('Salta - San Sebastian', (SELECT id FROM provincia WHERE nombre = 'Salta'))
RETURNING id, nombre, provincia_id;
