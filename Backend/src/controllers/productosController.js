import pool from '../config/database.js';
import { scopeSql, userForRead, resolveLocalidadForWrite, sendScopeError } from '../utils/scope.js';

export const getProductos = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', userForRead(req), 1);
    const result = await pool.query(`
      SELECT id, codigo, nombre, activo, created_at,
             localidad_id, (SELECT nombre FROM localidad l WHERE l.id = producto.localidad_id) AS localidad_nombre
      FROM producto
      WHERE activo = true
        AND ${scope.sql}
      ORDER BY nombre ASC
    `, [...scope.params]);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getProductoById = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', userForRead(req), 2);
    const result = await pool.query(
      `SELECT * FROM producto WHERE id = $1 AND ${scope.sql}`,
      [req.params.id, ...scope.params]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createProducto = async (req, res) => {
  try {
    const { codigo, nombre } = req.body;
    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }
    const localidadId = await resolveLocalidadForWrite(req);
    const result = await pool.query(
      'INSERT INTO producto (codigo, nombre, activo, localidad_id) VALUES ($1, $2, true, $3) RETURNING *',
      [codigo || null, nombre, localidadId]
    );
    res.status(201).json({ success: true, message: 'Producto creado', data: result.rows[0] });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, activo } = req.body;
    const scope = scopeSql('localidad_id', req.user, 5);
    const result = await pool.query(`
      UPDATE producto
      SET codigo = COALESCE($1, codigo), nombre = COALESCE($2, nombre),
          activo = COALESCE($3, activo), updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
        AND ${scope.sql}
      RETURNING *
    `, [codigo, nombre, activo, id, ...scope.params]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }
    res.json({ success: true, message: 'Producto actualizado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteProducto = async (req, res) => {
  try {
    const scope = scopeSql('localidad_id', req.user, 2);
    const result = await pool.query(`
      UPDATE producto SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND ${scope.sql}
      RETURNING *
    `, [req.params.id, ...scope.params]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }
    res.json({ success: true, message: 'Producto eliminado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
