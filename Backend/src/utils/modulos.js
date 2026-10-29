import pool from '../config/database.js';
import { ScopeError } from './scope.js';

// Módulos que van según el plan de cada localidad (columna localidad.modulo_<nombre>).
// Los habilita solo el superadmin (PUT /api/localidades/:id/modulos).

export const MODULO_CAMARAS_DESHABILITADO = 'MODULO_CAMARAS_DESHABILITADO';

export const moduloCamarasHabilitado = async (localidadId) => {
    if (!localidadId) return false;
    const { rows } = await pool.query('SELECT modulo_camaras FROM localidad WHERE id = $1', [localidadId]);
    return rows[0]?.modulo_camaras === true;
};

export const assertModuloCamaras = async (localidadId) => {
    if (!(await moduloCamarasHabilitado(localidadId))) {
        const err = new ScopeError('El módulo de cámaras no está habilitado para esta localidad', 403);
        err.code = MODULO_CAMARAS_DESHABILITADO;
        throw err;
    }
};
