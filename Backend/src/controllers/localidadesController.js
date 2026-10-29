import pool from '../config/database.js';
import { getScope, scopeSql, ScopeError, sendScopeError } from '../utils/scope.js';

// Solo usuarios sin localidad (admin de empresa / superadmin) gestionan localidades
const assertGestionLocalidades = (user) => {
    if (user?.localidad_id) throw new ScopeError('Solo un administrador de empresa puede gestionar localidades');
};

const resolverEmpresa = (user, empresaId) => {
    const scope = getScope(user);
    if (!scope.isSuperadmin) return scope.empresaId;
    if (!empresaId) throw new ScopeError('Debe indicar empresa_id', 400);
    return parseInt(empresaId, 10);
};

export const getLocalidades = async (req, res) => {
    try {
        const scope = scopeSql('l.id', req.user, 1);
        const result = await pool.query(`
      SELECT l.*, p.nombre as provincia_nombre, e.nombre as empresa_nombre
      FROM localidad l 
      LEFT JOIN provincia p ON l.provincia_id = p.id 
      LEFT JOIN empresa e ON l.empresa_id = e.id
      WHERE ${scope.sql}
      ORDER BY l.nombre ASC
    `, scope.params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const createLocalidad = async (req, res) => {
    try {
        assertGestionLocalidades(req.user);
        const { nombre, provincia_id, empresa_id } = req.body;
        if (!nombre) return res.status(400).json({ success: false, error: 'El nombre de la localidad es requerido' });
        if (!provincia_id) return res.status(400).json({ success: false, error: 'El ID de la provincia es requerido (debe ser un número)' });
        const empresaId = resolverEmpresa(req.user, empresa_id);

        const result = await pool.query(
            'INSERT INTO localidad (nombre, provincia_id, empresa_id) VALUES ($1, $2, $3) RETURNING *',
            [nombre, provincia_id, empresaId]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        sendScopeError(res, error);
    }
};

export const updateLocalidad = async (req, res) => {
    try {
        assertGestionLocalidades(req.user);
        const { id } = req.params;
        const { nombre, provincia_id } = req.body;
        const scope = scopeSql('id', req.user, 4);
        const result = await pool.query(
            `UPDATE localidad SET 
       nombre = COALESCE($1, nombre), 
       provincia_id = COALESCE($2, provincia_id), 
       updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 AND ${scope.sql} RETURNING *`,
            [nombre, provincia_id, id, ...scope.params]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Localidad no encontrada' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        sendScopeError(res, error);
    }
};

// PUT /api/localidades/:id/modulos — { camaras: bool }. Los módulos van por plan: solo superadmin.
export const updateModulos = async (req, res) => {
    try {
        if (!getScope(req.user).isSuperadmin) {
            throw new ScopeError('Solo el superadmin puede habilitar módulos', 403);
        }
        const { camaras } = req.body;
        if (typeof camaras !== 'boolean') throw new ScopeError('Debe indicar camaras: true o false', 400);
        const result = await pool.query(
            `UPDATE localidad SET modulo_camaras = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING id, nombre, modulo_camaras`,
            [camaras, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Localidad no encontrada' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        sendScopeError(res, error);
    }
};

export const deleteLocalidad = async (req, res) => {
    try {
        assertGestionLocalidades(req.user);
        const { id } = req.params;
        const scope = scopeSql('id', req.user, 2);
        const result = await pool.query(`DELETE FROM localidad WHERE id = $1 AND ${scope.sql} RETURNING *`, [id, ...scope.params]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Localidad no encontrada' });
        res.json({ success: true, message: 'Localidad eliminada' });
    } catch (error) {
        sendScopeError(res, error);
    }
};
