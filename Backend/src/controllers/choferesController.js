import pool from '../config/database.js';

export const getChoferes = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      SELECT id, codigo, apellido_nombre, tipo_documento, nro_documento, cuit, nacionalidad, activo, created_at
      FROM chofer
      WHERE activo = true
        AND ($1::int IS NULL OR localidad_id = $1)
      ORDER BY apellido_nombre ASC
    `, [localidadId]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getChoferById = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(
      'SELECT * FROM chofer WHERE id = $1 AND ($2::int IS NULL OR localidad_id = $2)',
      [req.params.id, localidadId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chofer no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createChofer = async (req, res) => {
  try {
    const { codigo, apellido_nombre, tipo_documento, nro_documento, cuit, nacionalidad } = req.body;
    if (!apellido_nombre) {
      return res.status(400).json({ success: false, error: 'El nombre del chofer es requerido' });
    }
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      INSERT INTO chofer (codigo, apellido_nombre, tipo_documento, nro_documento, cuit, nacionalidad, activo, localidad_id)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING *
    `, [codigo || null, apellido_nombre, tipo_documento || null, nro_documento || null, cuit || null, nacionalidad || null, localidadId]);
    res.status(201).json({ success: true, message: 'Chofer creado exitosamente', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateChofer = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, apellido_nombre, tipo_documento, nro_documento, cuit, nacionalidad, activo } = req.body;
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      UPDATE chofer
      SET codigo = COALESCE($1, codigo),
          apellido_nombre = COALESCE($2, apellido_nombre),
          tipo_documento = COALESCE($3, tipo_documento),
          nro_documento = COALESCE($4, nro_documento),
          cuit = COALESCE($5, cuit),
          nacionalidad = COALESCE($6, nacionalidad),
          activo = COALESCE($7, activo),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
        AND ($9::int IS NULL OR localidad_id = $9)
      RETURNING *
    `, [codigo, apellido_nombre, tipo_documento, nro_documento, cuit, nacionalidad, activo, id, localidadId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chofer no encontrado' });
    }
    res.json({ success: true, message: 'Chofer actualizado exitosamente', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteChofer = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      UPDATE chofer
      SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND ($2::int IS NULL OR localidad_id = $2)
      RETURNING *
    `, [req.params.id, localidadId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chofer no encontrado' });
    }
    res.json({ success: true, message: 'Chofer eliminado exitosamente', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
