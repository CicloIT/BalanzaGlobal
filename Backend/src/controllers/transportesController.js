import pool from '../config/database.js';

export const getTransportes = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      SELECT id, codigo, nombre, cuit, activo, created_at
      FROM transporte
      WHERE activo = true
        AND ($1::int IS NULL OR localidad_id = $1)
      ORDER BY nombre ASC
    `, [localidadId]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getTransporteById = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(
      'SELECT * FROM transporte WHERE id = $1 AND ($2::int IS NULL OR localidad_id = $2)',
      [req.params.id, localidadId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Transporte no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createTransporte = async (req, res) => {
  try {
    const { codigo, nombre, cuit } = req.body;
    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(
      'INSERT INTO transporte (codigo, nombre, cuit, activo, localidad_id) VALUES ($1, $2, $3, true, $4) RETURNING *',
      [codigo || null, nombre, cuit || null, localidadId]
    );
    res.status(201).json({ success: true, message: 'Transporte creado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateTransporte = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, cuit, activo } = req.body;
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      UPDATE transporte
      SET codigo = COALESCE($1, codigo), nombre = COALESCE($2, nombre),
          cuit = COALESCE($3, cuit), activo = COALESCE($4, activo),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
        AND ($6::int IS NULL OR localidad_id = $6)
      RETURNING *
    `, [codigo, nombre, cuit, activo, id, localidadId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Transporte no encontrado' });
    }
    res.json({ success: true, message: 'Transporte actualizado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteTransporte = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      UPDATE transporte SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND ($2::int IS NULL OR localidad_id = $2)
      RETURNING *
    `, [req.params.id, localidadId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Transporte no encontrado' });
    }
    res.json({ success: true, message: 'Transporte eliminado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
