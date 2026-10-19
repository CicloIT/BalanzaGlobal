import pool from '../config/database.js';
import { scopeSql, userForRead, resolveLocalidadForWrite, sendScopeError } from '../utils/scope.js';

export const getOperaciones = async (req, res) => {
    try {
        const scope = scopeSql('localidad_id', userForRead(req), 1);
        const result = await pool.query(
            `SELECT * FROM operacion_pesaje WHERE ${scope.sql} ORDER BY created_at DESC`,
            [...scope.params]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getOperacionAbiertaByPatente = async (req, res) => {
    try {
        const { patente } = req.params;
        const scope = scopeSql('localidad_id', userForRead(req), 2);
        const result = await pool.query(
            `SELECT * FROM operacion_pesaje WHERE vehiculo_patente = $1 AND abierta = true AND ${scope.sql}`,
            [patente, ...scope.params]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No hay operación abierta para esta patente' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const closeOperacion = async (req, res) => {
    try {
        const { id } = req.params;
        const scope = scopeSql('localidad_id', req.user, 2);
        const result = await pool.query(
            `UPDATE operacion_pesaje SET abierta = false WHERE id = $1 AND ${scope.sql} RETURNING *`,
            [id, ...scope.params]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Operación no encontrada' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
