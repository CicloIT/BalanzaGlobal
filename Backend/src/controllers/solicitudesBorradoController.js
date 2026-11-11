import pool from '../config/database.js';
import { scopeSql, ScopeError, sendScopeError } from '../utils/scope.js';

/**
 * Pedidos de borrado de operaciones de pesaje (los crea el balancero desde el historial,
 * ver solicitarBorrado en pesadasController). Los resuelve quien tiene pesaje:delete.
 *  - aprobar  → borra las operaciones (cascada a pesada); el snapshot queda en la solicitud
 *  - rechazar → las operaciones vuelven a verse
 */

const ESTADOS = ['pendiente', 'aprobada', 'rechazada'];

export const getSolicitudes = async (req, res) => {
  try {
    const estado = ESTADOS.includes(req.query.estado) ? req.query.estado : 'pendiente';
    const limit = Math.min(Math.max(parseInt(req.query.limit ?? 50, 10) || 50, 1), 200);
    const scope = scopeSql('s.localidad_id', req.user, 2);
    const result = await pool.query(
      `SELECT s.id, s.localidad_id, loc.nombre AS localidad_nombre,
              s.motivo, s.estado, s.created_at,
              s.solicitado_por, us.username AS solicitado_por_username,
              s.resuelto_por, ur.username AS resuelto_por_username,
              s.resuelto_at, s.comentario_resolucion,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object('operacion_id', so.operacion_id) || so.datos ORDER BY so.operacion_id)
                FROM solicitud_borrado_operacion so WHERE so.solicitud_id = s.id
              ), '[]'::jsonb) AS operaciones
       FROM solicitud_borrado s
       JOIN localidad loc ON loc.id = s.localidad_id
       JOIN usuario us ON us.id = s.solicitado_por
       LEFT JOIN usuario ur ON ur.id = s.resuelto_por
       WHERE s.estado = $1 AND ${scope.sql}
       ORDER BY ${estado === 'pendiente' ? 's.created_at ASC' : 'COALESCE(s.resuelto_at, s.created_at) DESC'}
       LIMIT ${limit}`,
      [estado, ...scope.params]
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const contarPendientes = async (req, res) => {
  try {
    const scope = scopeSql('s.localidad_id', req.user, 1);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM solicitud_borrado s WHERE s.estado = 'pendiente' AND ${scope.sql}`,
      scope.params
    );
    res.json({ success: true, count: result.rows[0].count });
  } catch (error) {
    sendScopeError(res, error);
  }
};

// Bloquea la solicitud (dentro del alcance) y verifica que siga pendiente
const tomarPendiente = async (client, req) => {
  const id = parseInt(req.params.id, 10);
  if (!id) throw new ScopeError('Solicitud inválida', 400);
  const scope = scopeSql('s.localidad_id', req.user, 2);
  const r = await client.query(
    `SELECT s.id, s.estado FROM solicitud_borrado s WHERE s.id = $1 AND ${scope.sql} FOR UPDATE`,
    [id, ...scope.params]
  );
  if (!r.rows.length) throw new ScopeError('Solicitud no encontrada', 404);
  if (r.rows[0].estado !== 'pendiente') {
    throw new ScopeError(`La solicitud ya fue ${r.rows[0].estado}`, 409);
  }
  return id;
};

const resolver = (accion) => async (req, res) => {
  const client = await pool.connect();
  try {
    const comentario = typeof req.body?.comentario === 'string' ? req.body.comentario.trim() || null : null;
    await client.query('BEGIN');
    const id = await tomarPendiente(client, req);

    let operaciones;
    if (accion === 'aprobada') {
      const del = await client.query('DELETE FROM operacion_pesaje WHERE borrado_solicitud_id = $1', [id]);
      operaciones = del.rowCount;
    } else {
      const upd = await client.query(
        'UPDATE operacion_pesaje SET borrado_solicitud_id = NULL WHERE borrado_solicitud_id = $1',
        [id]
      );
      operaciones = upd.rowCount;
    }

    await client.query(
      `UPDATE solicitud_borrado
       SET estado = $2, resuelto_por = $3, resuelto_at = CURRENT_TIMESTAMP, comentario_resolucion = $4
       WHERE id = $1`,
      [id, accion, req.user.id, comentario]
    );
    await client.query('COMMIT');

    const ops = operaciones === 1 ? '1 operación' : `${operaciones} operaciones`;
    res.json({
      success: true,
      message: accion === 'aprobada'
        ? `Pedido aprobado: ${ops} ${operaciones === 1 ? 'eliminada' : 'eliminadas'}`
        : `Pedido rechazado: ${ops} ${operaciones === 1 ? 'vuelve' : 'vuelven'} a verse en el historial`,
      operaciones,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    sendScopeError(res, error);
  } finally {
    client.release();
  }
};

export const aprobarSolicitud = resolver('aprobada');
export const rechazarSolicitud = resolver('rechazada');
