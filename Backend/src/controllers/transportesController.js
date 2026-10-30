import pool from '../config/database.js';
import { scopeSql, userForRead, resolveLocalidadForWrite, sendScopeError } from '../utils/scope.js';
import { crearOReactivar, darDeBaja } from '../utils/catalogos.js';

export const getTransportes = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', userForRead(req), 1);
    const result = await pool.query(`
      SELECT id, codigo, nombre, cuit, activo, created_at,
             localidad_id, (SELECT nombre FROM localidad l WHERE l.id = transporte.localidad_id) AS localidad_nombre
      FROM transporte
      WHERE activo = true
        AND ${scope.sql}
      ORDER BY nombre ASC
    `, [...scope.params]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const getTransporteById = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', userForRead(req), 2);
    const result = await pool.query(
      `SELECT * FROM transporte WHERE id = $1 AND ${scope.sql}`,
      [req.params.id, ...scope.params]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Transporte no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const createTransporte = async (req, res) => {
  try {
    const { codigo, nombre, cuit } = req.body;
    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }
    const localidadId = await resolveLocalidadForWrite(req);
    const { row, reactivado } = await crearOReactivar('transporte', { codigo: codigo || null, nombre, cuit: cuit || null },
      ['codigo', 'nombre'], localidadId);
    res.status(201).json({ success: true, message: reactivado ? 'Transporte reactivado' : 'Transporte creado', data: row });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const updateTransporte = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, cuit, activo } = req.body;
    const scope = scopeSql('localidad_id', req.user, 6);
    const result = await pool.query(`
      UPDATE transporte
      SET codigo = COALESCE($1, codigo), nombre = COALESCE($2, nombre),
          cuit = COALESCE($3, cuit), activo = COALESCE($4, activo),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
        AND ${scope.sql}
      RETURNING *
    `, [codigo, nombre, cuit, activo, id, ...scope.params]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Transporte no encontrado' });
    }
    res.json({ success: true, message: 'Transporte actualizado', data: result.rows[0] });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const deleteTransporte = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', req.user, 2);
    const eliminado = await darDeBaja('transporte', req.params.id, scope);
    if (!eliminado) {
      return res.status(404).json({ success: false, error: 'Transporte no encontrado' });
    }
    res.json({ success: true, message: 'Transporte eliminado', data: eliminado });
  } catch (error) {
    sendScopeError(res, error);
  }
};
