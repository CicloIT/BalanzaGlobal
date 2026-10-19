import pool from "../config/database.js";
import { reconectarBalanza, getEstadoBalanza } from "../services/balanzaService.js";
import { scopeSql, userForRead, resolveLocalidadForWrite, sendScopeError } from "../utils/scope.js";

export const getConfiguracion = async (req, res) => {
    try {
        // Usuario global: ?localidad_id= elige la localidad a configurar
        const scope = scopeSql('localidad_id', userForRead(req), 1);
        const result = await pool.query(`
            SELECT id, tipo_dispositivo, ip, puerto, usuario, contraseña, activo, localidad_id, marca
            FROM configuracion_dispositivos
            WHERE activo = true
              AND ${scope.sql}
            ORDER BY localidad_id, id
        `, scope.params);

        const config = {};

        result.rows.forEach(row => {
            config[row.tipo_dispositivo] = row;
        });

        res.json({
            success: true,
            data: config
        });

    } catch (error) {
        sendScopeError(res, error);
    }
};

export const updateConfiguracion = async (req, res) => {
    const { tipo } = req.params;
    const { ip, puerto, usuario, contraseña, activo, marca, localidad_id: bodyLocalidadId } = req.body;

    try {
        // Usuario con localidad fija → usa la suya. Usuario global → localidad_id del body, dentro de su empresa.
        const localidadId = await resolveLocalidadForWrite(req, bodyLocalidadId);

        const result = await pool.query(`
            UPDATE configuracion_dispositivos
            SET
                ip = COALESCE($1, ip),
                puerto = COALESCE($2, puerto),
                usuario = COALESCE($3, usuario),
                contraseña = COALESCE($4, contraseña),
                activo = COALESCE($5, activo),
                marca = COALESCE($6, marca),
                fecha_actualizacion = NOW()
            WHERE tipo_dispositivo = $7
              AND localidad_id = $8
            RETURNING *
        `, [ip, puerto, usuario, contraseña, activo, marca || null, tipo.toLowerCase(), localidadId]);

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Configuración no encontrada"
            });
        }

        // Si se actualizó la balanza, reconectar el socket TCP con la nueva config
        if (tipo.toLowerCase() === 'balanza') {
            reconectarBalanza(result.rows[0].id).catch(err =>
                console.error('❌ Error al reconectar balanza:', err.message)
            );
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        sendScopeError(res, error);
    }
};

// GET /api/config/balanzas — balanzas activas dentro del alcance, con estado de conexión
export const getBalanzas = async (req, res) => {
    try {
        const scope = scopeSql('cd.localidad_id', req.user, 1);
        const result = await pool.query(`
            SELECT cd.id, cd.localidad_id, l.nombre AS localidad_nombre
            FROM configuracion_dispositivos cd
            JOIN localidad l ON l.id = cd.localidad_id
            WHERE cd.tipo_dispositivo = 'balanza' AND cd.activo = true
              AND ${scope.sql}
            ORDER BY l.nombre
        `, scope.params);
        const data = result.rows.map(row => {
            const estado = getEstadoBalanza(row.id);
            return { ...row, connected: estado?.connected ?? false, lastWeight: estado?.lastWeight ?? null };
        });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
