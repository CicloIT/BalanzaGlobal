/**
 * Alta y baja de catálogos por localidad (chofer, vehiculo, producto, productor, transporte).
 *
 * Las claves únicas (código, nombre, patente...) no miran `activo`, así que un registro dado de baja
 * bloquearía volver a cargarlo. Por eso:
 *  - la baja borra el registro si nada lo usa, y solo lo deja inactivo si ya está en pesadas (historial);
 *  - el alta reactiva un registro inactivo de la misma localidad que coincida en alguna clave.
 *
 * `tabla` y los nombres de columna vienen siempre del código, nunca del request.
 */
import pool from '../config/database.js';

/** @returns {Promise<object|null>} fila borrada o inactivada; null si no existe en el alcance */
export const darDeBaja = async (tabla, id, scope) => {
  const params = [id, ...scope.params];
  try {
    const result = await pool.query(`DELETE FROM ${tabla} WHERE id = $1 AND ${scope.sql} RETURNING *`, params);
    return result.rows[0] || null;
  } catch (error) {
    if (error.code !== '23503') throw error; // referenciado por pesadas/operaciones
    const result = await pool.query(
      `UPDATE ${tabla} SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND ${scope.sql} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
};

/**
 * @param {object} datos - columna → valor (sin activo ni localidad_id)
 * @param {string[]} claves - columnas únicas por localidad para buscar un inactivo
 * @returns {Promise<{row: object, reactivado: boolean}>}
 */
export const crearOReactivar = async (tabla, datos, claves, localidadId) => {
  const cols = Object.keys(datos);
  const valores = cols.map((c) => datos[c]);

  const clavesConValor = claves.filter((c) => datos[c] != null);
  if (clavesConValor.length) {
    const inactivo = await pool.query(
      `SELECT id FROM ${tabla}
       WHERE localidad_id = $1 AND activo = false
         AND (${clavesConValor.map((c, i) => `${c} = $${i + 2}`).join(' OR ')})
       ORDER BY id LIMIT 1`,
      [localidadId, ...clavesConValor.map((c) => datos[c])]
    );
    if (inactivo.rows.length) {
      const result = await pool.query(
        `UPDATE ${tabla} SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, activo = true, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [inactivo.rows[0].id, ...valores]
      );
      return { row: result.rows[0], reactivado: true };
    }
  }

  const result = await pool.query(
    `INSERT INTO ${tabla} (${cols.join(', ')}, activo, localidad_id)
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, true, $${cols.length + 1}) RETURNING *`,
    [...valores, localidadId]
  );
  return { row: result.rows[0], reactivado: false };
};
