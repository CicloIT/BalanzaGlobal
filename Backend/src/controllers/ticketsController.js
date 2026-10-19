import pool from '../config/database.js';
import { scopeSql, userForRead, resolveLocalidadForWrite, sendScopeError } from '../utils/scope.js';

export const getTickets = async (req, res) => {
  try {
    const scope = scopeSql('t.localidad_id', userForRead(req), 1);
    const result = await pool.query(`
      SELECT t.id, t.numero_ticket, t.estado, t.observaciones, t.nro_remito, t.created_at,
             p.peso, p.tipo as tipo_pesada, p.neto, p.fecha_hora as fecha_pesada,
             c.apellido_nombre as chofer_nombre,
             pr.nombre as productor_nombre,
             tr.nombre as transporte_nombre,
             v.patente as vehiculo_patente,
             p.balancero
      FROM ticket t
      LEFT JOIN pesada p ON t.pesada_id = p.id
      LEFT JOIN chofer c ON p.chofer_id = c.id
      LEFT JOIN productor pr ON p.productor_id = pr.id
      LEFT JOIN transporte tr ON p.transporte_id = tr.id
      LEFT JOIN vehiculo v ON p.vehiculo_patente = v.patente
      WHERE ${scope.sql}
      ORDER BY t.numero_ticket DESC
      LIMIT 100
    `, [...scope.params]);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = scopeSql('t.localidad_id', req.user, 2);
    const result = await pool.query(`
      SELECT t.*, 
             p.peso, p.tipo, p.neto, p.fecha_hora,
             c.apellido_nombre as chofer_nombre, c.nro_documento as chofer_documento,
             pr.nombre as productor_nombre,
             tr.nombre as transporte_nombre, tr.cuit as transporte_cuit,
             prod.nombre as producto_nombre,
             v.patente, v.patente_acoplado, v.tipo_vehiculo,
             p.balancero
      FROM ticket t
      LEFT JOIN pesada p ON t.pesada_id = p.id
      LEFT JOIN chofer c ON p.chofer_id = c.id
      LEFT JOIN productor pr ON p.productor_id = pr.id
      LEFT JOIN transporte tr ON p.transporte_id = tr.id
      LEFT JOIN producto prod ON p.producto_id = prod.id
      LEFT JOIN vehiculo v ON p.vehiculo_patente = v.patente
      WHERE t.id = $1 AND ${scope.sql}
    `, [id, ...scope.params]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getTicketsByEstado = async (req, res) => {
  try {
    const { estado } = req.params;
    const scope = scopeSql('t.localidad_id', userForRead(req), 2);
    const result = await pool.query(`
      SELECT t.id, t.numero_ticket, t.estado, t.observaciones, t.nro_remito, t.created_at,
             p.peso, p.tipo as tipo_pesada, p.neto, p.fecha_hora as fecha_pesada,
             c.apellido_nombre as chofer_nombre,
             pr.nombre as productor_nombre,
             tr.nombre as transporte_nombre,
             v.patente as vehiculo_patente,
             p.balancero
      FROM ticket t
      LEFT JOIN pesada p ON t.pesada_id = p.id
      LEFT JOIN chofer c ON p.chofer_id = c.id
      LEFT JOIN productor pr ON p.productor_id = pr.id
      LEFT JOIN transporte tr ON p.transporte_id = tr.id
      LEFT JOIN vehiculo v ON p.vehiculo_patente = v.patente
      WHERE t.estado = $1 AND ${scope.sql}
      ORDER BY t.numero_ticket DESC
    `, [estado, ...scope.params]);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createTicket = async (req, res) => {
  try {
    const {
      pesada_id,
      nro_remito,
      observaciones,
    } = req.body;

    if (!pesada_id) {
      return res.status(400).json({ success: false, error: 'pesada_id es requerido' });
    }

    const localidadId = await resolveLocalidadForWrite(req);
    const result = await pool.query(
      `INSERT INTO ticket (
        pesada_id, nro_remito, observaciones, estado, localidad_id
      ) VALUES ($1, $2, $3, 'CERRADO', $4)
      RETURNING *`,
      [pesada_id, nro_remito || null, observaciones || null, localidadId]
    );

    res.status(201).json({
      success: true,
      message: 'Ticket creado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observaciones, nro_remito } = req.body;
    const scope = scopeSql('localidad_id', req.user, 5);

    const result = await pool.query(
      `UPDATE ticket SET
       estado = COALESCE($1, estado),
       observaciones = COALESCE($2, observaciones),
       nro_remito = COALESCE($3, nro_remito),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND ${scope.sql} RETURNING *`,
      [estado, observaciones, nro_remito, id, ...scope.params]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket no encontrado' });
    }

    res.json({
      success: true,
      message: 'Ticket actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const closeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = scopeSql('localidad_id', req.user, 2);

    const result = await pool.query(
      `UPDATE ticket SET
       estado = 'CERRADO',
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND ${scope.sql} RETURNING *`,
      [id, ...scope.params]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket no encontrado' });
    }

    res.json({
      success: true,
      message: 'Ticket cerrado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getTicketsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate y endDate son requeridos' });
    }

    const scope = scopeSql('t.localidad_id', userForRead(req), 3);
    const result = await pool.query(`
      SELECT t.*, p.fecha_hora, v.patente
      FROM ticket t
      JOIN pesada p ON t.pesada_id = p.id
      JOIN vehiculo v ON p.vehiculo_patente = v.patente
      WHERE p.fecha_hora >= $1::DATE
        AND p.fecha_hora < $2::DATE + INTERVAL '1 day'
        AND ${scope.sql}
      ORDER BY p.fecha_hora DESC
    `, [startDate, endDate, ...scope.params]);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
