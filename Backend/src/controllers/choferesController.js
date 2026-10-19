import pool from '../config/database.js';
import { scopeSql, userForRead, resolveLocalidadForWrite, sendScopeError } from '../utils/scope.js';

export const getChoferes = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', userForRead(req), 1);
    const result = await pool.query(`
      SELECT id, codigo, apellido_nombre, tipo_documento, nro_documento, cuit, nacionalidad, activo, created_at,
             localidad_id, (SELECT nombre FROM localidad l WHERE l.id = chofer.localidad_id) AS localidad_nombre
      FROM chofer
      WHERE activo = true
        AND ${scope.sql}
      ORDER BY apellido_nombre ASC
    `, [...scope.params]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getChoferById = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', userForRead(req), 2);
    const result = await pool.query(
      `SELECT * FROM chofer WHERE id = $1 AND ${scope.sql}`,
      [req.params.id, ...scope.params]
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
    const localidadId = await resolveLocalidadForWrite(req);
    const result = await pool.query(`
      INSERT INTO chofer (codigo, apellido_nombre, tipo_documento, nro_documento, cuit, nacionalidad, activo, localidad_id)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING *
    `, [codigo || null, apellido_nombre, tipo_documento || null, nro_documento || null, cuit || null, nacionalidad || null, localidadId]);
    res.status(201).json({ success: true, message: 'Chofer creado exitosamente', data: result.rows[0] });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const updateChofer = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, apellido_nombre, tipo_documento, nro_documento, cuit, nacionalidad, activo } = req.body;
    const scope = scopeSql('localidad_id', req.user, 9);
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
        AND ${scope.sql}
      RETURNING *
    `, [codigo, apellido_nombre, tipo_documento, nro_documento, cuit, nacionalidad, activo, id, ...scope.params]);
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
    const scope = scopeSql('localidad_id', req.user, 2);
    const result = await pool.query(`
      UPDATE chofer
      SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND ${scope.sql}
      RETURNING *
    `, [req.params.id, ...scope.params]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chofer no encontrado' });
    }
    res.json({ success: true, message: 'Chofer eliminado exitosamente', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
