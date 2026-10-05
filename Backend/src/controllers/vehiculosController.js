import pool from '../config/database.js';

export const getVehiculos = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const limit  = Math.min(parseInt(req.query.limit  ?? 50, 10), 9999);
    const page   = Math.max(parseInt(req.query.page   ?? 1,  10), 1);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || null;

    const localidadClause = `($1::int IS NULL OR v.localidad_id = $1)`;
    const searchClause = search
      ? `AND (v.patente ILIKE $4 OR v.tipo_vehiculo::text ILIKE $4 OR COALESCE(v.patente_acoplado,'') ILIKE $4)`
      : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM vehiculo v WHERE v.activo = true AND ${localidadClause} ${searchClause}`,
      search ? [localidadId, limit, offset, `%${search}%`] : [localidadId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(`
      SELECT v.id, v.patente, v.patente_acoplado, v.tipo_vehiculo, v.activo, v.observaciones, v.created_at
      FROM vehiculo v
      WHERE v.activo = true AND ${localidadClause} ${searchClause}
      ORDER BY v.patente ASC
      LIMIT $2 OFFSET $3
    `, search ? [localidadId, limit, offset, `%${search}%`] : [localidadId, limit, offset]);

    const hasMore = (result.rows.length === limit) && (offset + result.rows.length < total);
    res.json({ success: true, data: result.rows, count: result.rows.length, total, page, limit, hasMore });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getVehiculoById = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(
      'SELECT * FROM vehiculo WHERE id = $1 AND ($2::int IS NULL OR localidad_id = $2)',
      [req.params.id, localidadId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehículo no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createVehiculo = async (req, res) => {
  try {
    const { patente, patente_acoplado, tipo_vehiculo, observaciones } = req.body;
    if (!patente || !tipo_vehiculo) {
      return res.status(400).json({ success: false, error: 'Patente y tipo_vehiculo son requeridos' });
    }
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(
      'INSERT INTO vehiculo (patente, patente_acoplado, tipo_vehiculo, observaciones, activo, localidad_id) VALUES ($1, $2, $3, $4, true, $5) RETURNING *',
      [patente, patente_acoplado || null, tipo_vehiculo, observaciones || null, localidadId]
    );
    res.status(201).json({ success: true, message: 'Vehículo creado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const { patente, patente_acoplado, tipo_vehiculo, observaciones, activo } = req.body;
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      UPDATE vehiculo
      SET patente = COALESCE($1, patente), patente_acoplado = COALESCE($2, patente_acoplado),
          tipo_vehiculo = COALESCE($3, tipo_vehiculo), observaciones = COALESCE($4, observaciones),
          activo = COALESCE($5, activo), updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
        AND ($7::int IS NULL OR localidad_id = $7)
      RETURNING *
    `, [patente, patente_acoplado, tipo_vehiculo, observaciones, activo, id, localidadId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehículo no encontrado' });
    }
    res.json({ success: true, message: 'Vehículo actualizado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteVehiculo = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      UPDATE vehiculo SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND ($2::int IS NULL OR localidad_id = $2)
      RETURNING *
    `, [req.params.id, localidadId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehículo no encontrado' });
    }
    res.json({ success: true, message: 'Vehículo eliminado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getVehiculosParaSelect = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await pool.query(`
      SELECT id, patente
      FROM vehiculo
      WHERE activo = true
        AND ($1::int IS NULL OR localidad_id = $1)
      ORDER BY patente ASC
    `, [localidadId]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
