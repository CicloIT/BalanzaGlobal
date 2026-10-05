import pool from "../config/database.js";
import { reconectarBalanza } from "../services/balanzaService.js";

export const getConfiguracion = async (req, res) => {
    try {
        const localidadId = req.user?.localidad_id ?? null;
        const result = await pool.query(`
            SELECT id, tipo_dispositivo, ip, puerto, usuario, contraseña, activo, localidad_id, marca
            FROM configuracion_dispositivos
            WHERE activo = true
              AND ($1::int IS NULL OR localidad_id = $1)
        `, [localidadId]);

        const config = {};

        result.rows.forEach(row => {
            config[row.tipo_dispositivo] = row;
        });

        res.json({
            success: true,
            data: config
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const updateConfiguracion = async (req, res) => {
    const { tipo } = req.params;
    const { ip, puerto, usuario, contraseña, activo, marca, localidad_id: bodyLocalidadId } = req.body;

    try {
        // Usuario con localidad fija → usa la suya. Admin global → requiere localidad_id en body.
        const userLocalidadId = req.user?.localidad_id ?? null;
        const localidadId = userLocalidadId ?? (bodyLocalidadId ? parseInt(bodyLocalidadId) : null);

        if (localidadId === null) {
            return res.status(400).json({
                success: false,
                message: "Se requiere localidad_id para actualizar la configuración"
            });
        }

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
            reconectarBalanza().catch(err =>
                console.error('❌ Error al reconectar balanza:', err.message)
            );
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};