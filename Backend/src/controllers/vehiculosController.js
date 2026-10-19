import pool from '../config/database.js';
import { scopeSql, userForRead, resolveLocalidadForWrite, sendScopeError } from '../utils/scope.js';

export const getVehiculos = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? 50, 10), 9999);
    const page   = Math.max(parseInt(req.query.page   ?? 1,  10), 1);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || null;

    const scope = scopeSql('v.localidad_id', userForRead(req), 1);
    const localidadClause = scope.sql;
    const searchClause = search
      ? `AND (v.patente ILIKE $3 OR v.tipo_vehiculo::text ILIKE $3 OR COALESCE(v.patente_acoplado,'') ILIKE $3)`
      : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM vehiculo v WHERE v.activo = true AND ${localidadClause} ${searchClause}`,
      search ? [...scope.params, `%${search}%`] : scope.params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(`
      SELECT v.id, v.patente, v.patente_acoplado, v.tipo_vehiculo, v.activo, v.observaciones, v.created_at,
             v.localidad_id, (SELECT nombre FROM localidad l WHERE l.id = v.localidad_id) AS localidad_nombre
      FROM vehiculo v
      WHERE v.activo = true AND ${localidadClause} ${searchClause}
      ORDER BY v.patente ASC
      LIMIT ${search ? '$4' : '$3'} OFFSET ${search ? '$5' : '$4'}
    `, search ? [...scope.params, `%${search}%`, limit, offset] : [...scope.params, limit, offset]);

    const hasMore = (result.rows.length === limit) && (offset + result.rows.length < total);
    res.json({ success: true, data: result.rows, count: result.rows.length, total, page, limit, hasMore });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getVehiculoById = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', userForRead(req), 2);
    const result = await pool.query(
      `SELECT * FROM vehiculo WHERE id = $1 AND ${scope.sql}`,
      [req.params.id, ...scope.params]
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
    const localidadId = await resolveLocalidadForWrite(req);
    const result = await pool.query(
      'INSERT INTO vehiculo (patente, patente_acoplado, tipo_vehiculo, observaciones, activo, localidad_id) VALUES ($1, $2, $3, $4, true, $5) RETURNING *',
      [patente, patente_acoplado || null, tipo_vehiculo, observaciones || null, localidadId]
    );
    res.status(201).json({ success: true, message: 'Vehículo creado', data: result.rows[0] });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const updateVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const { patente, patente_acoplado, tipo_vehiculo, observaciones, activo } = req.body;
    const scope = scopeSql('localidad_id', req.user, 7);
    const result = await pool.query(`
      UPDATE vehiculo
      SET patente = COALESCE($1, patente), patente_acoplado = COALESCE($2, patente_acoplado),
          tipo_vehiculo = COALESCE($3, tipo_vehiculo), observaciones = COALESCE($4, observaciones),
          activo = COALESCE($5, activo), updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
        AND ${scope.sql}
      RETURNING *
    `, [patente, patente_acoplado, tipo_vehiculo, observaciones, activo, id, ...scope.params]);
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
    const scope = scopeSql('localidad_id', req.user, 2);
    const result = await pool.query(`
      UPDATE vehiculo SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND ${scope.sql}
      RETURNING *
    `, [req.params.id, ...scope.params]);
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
    const scope = scopeSql('localidad_id', userForRead(req), 1);
    const result = await pool.query(`
      SELECT id, patente
      FROM vehiculo
      WHERE activo = true
        AND ${scope.sql}
      ORDER BY patente ASC
    `, [...scope.params]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
