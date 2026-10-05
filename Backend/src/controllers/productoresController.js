import pool from '../config/database.js';

export const getProductores = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      SELECT id, codigo, nombre, activo, created_at
      FROM productor
      WHERE activo = true
        AND ($1::int IS NULL OR localidad_id = $1)
      ORDER BY nombre ASC
    `, [localidadId]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getProductorById = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(
      'SELECT * FROM productor WHERE id = $1 AND ($2::int IS NULL OR localidad_id = $2)',
      [req.params.id, localidadId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Productor no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createProductor = async (req, res) => {
  try {
    const { codigo, nombre } = req.body;
    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(
      'INSERT INTO productor (codigo, nombre, activo, localidad_id) VALUES ($1, $2, true, $3) RETURNING *',
      [codigo || null, nombre, localidadId]
    );
    res.status(201).json({ success: true, message: 'Productor creado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateProductor = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, activo } = req.body;
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      UPDATE productor
      SET codigo = COALESCE($1, codigo), nombre = COALESCE($2, nombre),
          activo = COALESCE($3, activo), updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
        AND ($5::int IS NULL OR localidad_id = $5)
      RETURNING *
    `, [codigo, nombre, activo, id, localidadId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Productor no encontrado' });
    }
    res.json({ success: true, message: 'Productor actualizado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteProductor = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      UPDATE productor SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND ($2::int IS NULL OR localidad_id = $2)
      RETURNING *
    `, [req.params.id, localidadId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Productor no encontrado' });
    }
    res.json({ success: true, message: 'Productor eliminado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
