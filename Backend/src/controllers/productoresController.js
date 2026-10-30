import pool from '../config/database.js';
import { scopeSql, userForRead, resolveLocalidadForWrite, sendScopeError } from '../utils/scope.js';
import { crearOReactivar, darDeBaja } from '../utils/catalogos.js';

export const getProductores = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', userForRead(req), 1);
    const result = await pool.query(`
      SELECT id, codigo, nombre, activo, created_at,
             localidad_id, (SELECT nombre FROM localidad l WHERE l.id = productor.localidad_id) AS localidad_nombre
      FROM productor
      WHERE activo = true
        AND ${scope.sql}
      ORDER BY nombre ASC
    `, [...scope.params]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const getProductorById = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', userForRead(req), 2);
    const result = await pool.query(
      `SELECT * FROM productor WHERE id = $1 AND ${scope.sql}`,
      [req.params.id, ...scope.params]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Productor no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const createProductor = async (req, res) => {
  try {
    const { codigo, nombre } = req.body;
    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }
    const localidadId = await resolveLocalidadForWrite(req);
    const { row, reactivado } = await crearOReactivar('productor', { codigo: codigo || null, nombre }, ['codigo', 'nombre'], localidadId);
    res.status(201).json({ success: true, message: reactivado ? 'Productor reactivado' : 'Productor creado', data: row });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const updateProductor = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, activo } = req.body;
    const scope = scopeSql('localidad_id', req.user, 5);
    const result = await pool.query(`
      UPDATE productor
      SET codigo = COALESCE($1, codigo), nombre = COALESCE($2, nombre),
          activo = COALESCE($3, activo), updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
        AND ${scope.sql}
      RETURNING *
    `, [codigo, nombre, activo, id, ...scope.params]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Productor no encontrado' });
    }
    res.json({ success: true, message: 'Productor actualizado', data: result.rows[0] });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const deleteProductor = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', req.user, 2);
    const eliminado = await darDeBaja('productor', req.params.id, scope);
    if (!eliminado) {
      return res.status(404).json({ success: false, error: 'Productor no encontrado' });
    }
    res.json({ success: true, message: 'Productor eliminado', data: eliminado });
  } catch (error) {
    sendScopeError(res, error);
  }
};
