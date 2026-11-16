import pool from '../config/database.js';
import { getScope, scopeSql, ScopeError, sendScopeError } from '../utils/scope.js';
import { esCentral } from '../config/modo.js';
import { generarTokenSitio, hashTokenSitio, expulsarSitio } from '../services/sitioGateway.js';
import { reconectarBalanzasDeLocalidad } from '../services/balanzaService.js';

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
        // El hash del token del servidor de sitio no sale de la base
        res.json({ success: true, data: result.rows.map(({ sitio_token_hash, ...l }) => ({ ...l, sitio_con_token: Boolean(sitio_token_hash) })) });
    } catch (error) {
        sendScopeError(res, error);
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

// ─── Servidor propio de la localidad (modo sitio, v2) ─────────────────────────
const assertSuperadminCentral = (user) => {
    if (!esCentral()) throw new ScopeError('Esto se administra desde el servidor central', 403);
    if (!getScope(user).isSuperadmin) throw new ScopeError('Solo el superadmin gestiona servidores de sitio', 403);
};

// POST /api/localidades/:id/sitio-token → { token } (se muestra una sola vez; va en SITIO_TOKEN del sitio)
export const generarTokenSitioLocalidad = async (req, res) => {
    try {
        assertSuperadminCentral(req.user);
        const token = generarTokenSitio();
        const r = await pool.query(
            'UPDATE localidad SET sitio_token_hash = $2 WHERE id = $1 RETURNING id, nombre',
            [req.params.id, hashTokenSitio(token)]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Localidad no encontrada' });
        expulsarSitio(r.rows[0].id, 'Token regenerado');
        res.json({ success: true, data: { localidad_id: r.rows[0].id, token } });
    } catch (error) {
        sendScopeError(res, error);
    }
};

// DELETE /api/localidades/:id/sitio-token[?desactivar=1]
// Revoca el token. Con desactivar=1 la localidad vuelve a trabajar contra el central
// (lo que el sitio no haya subido queda solo en el sitio).
export const revocarTokenSitioLocalidad = async (req, res) => {
    try {
        assertSuperadminCentral(req.user);
        const desactivar = req.query.desactivar === '1';
        const r = await pool.query(
            `UPDATE localidad SET sitio_token_hash = NULL,
                    sitio_activo = CASE WHEN $2 THEN false ELSE sitio_activo END
             WHERE id = $1 RETURNING id, sitio_activo`,
            [req.params.id, desactivar]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Localidad no encontrada' });
        expulsarSitio(r.rows[0].id, 'Token revocado');
        if (desactivar) await reconectarBalanzasDeLocalidad(r.rows[0].id);
        res.json({ success: true, data: r.rows[0] });
    } catch (error) {
        sendScopeError(res, error);
    }
};
