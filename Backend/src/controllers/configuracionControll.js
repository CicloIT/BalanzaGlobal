import pool from "../config/database.js";
import { reconectarBalanza, getEstadoBalanza, expulsarAgente } from "../services/balanzaService.js";
import { hashToken, generarTokenAgente } from "../services/agenteGateway.js";
import { scopeSql, userForRead, resolveLocalidadForWrite, sendScopeError, ScopeError } from "../utils/scope.js";

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const validarDestino = ({ ip, puerto }) => {
    if (ip !== undefined && ip !== null && !IPV4.test(String(ip).trim())) {
        throw new ScopeError("IP inválida (formato IPv4, ej: 192.168.1.50)", 400);
    }
    if (puerto !== undefined && puerto !== null && !(Number.isInteger(puerto) && puerto >= 1 && puerto <= 65535)) {
        throw new ScopeError("Puerto inválido (1-65535)", 400);
    }
};

export const getConfiguracion = async (req, res) => {
    try {
        // Usuario global: ?localidad_id= elige la localidad a configurar (una fila por tipo y localidad)
        const user = userForRead(req);
        if (!user?.localidad_id) throw new ScopeError("Debe indicar localidad_id", 400);
        const scope = scopeSql('localidad_id', user, 1);
        const result = await pool.query(`
            SELECT id, tipo_dispositivo, ip, puerto, usuario, contraseña, activo, localidad_id, marca,
                   modo_conexion, agente_ultima_conexion, agente_info,
                   agente_token_hash IS NOT NULL AS con_token
            FROM configuracion_dispositivos
            WHERE activo = true
              AND ${scope.sql}
            ORDER BY localidad_id, id
        `, scope.params);

        const config = {};

        result.rows.forEach(row => {
            config[row.tipo_dispositivo] = row;
        });
        if (config.balanza) {
            config.balanza.agente_online = getEstadoBalanza(config.balanza.id)?.agente_online ?? false;
        }

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
        validarDestino({ ip, puerto });
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
        `, [ip?.trim() || null, puerto, usuario, contraseña, activo, marca || null, tipo.toLowerCase(), localidadId]);

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Configuración no encontrada"
            });
        }

        // Si se actualizó la balanza, reconectar el TCP (modo directo) o avisar al agente (modo agente)
        if (tipo.toLowerCase() === 'balanza') {
            reconectarBalanza(result.rows[0].id).catch(err =>
                console.error('❌ Error al reconectar balanza:', err.message)
            );
        }

        const { agente_token_hash, ...data } = result.rows[0];
        res.json({
            success: true,
            data
        });

    } catch (error) {
        sendScopeError(res, error);
    }
};

// POST /api/config/balanza/token — genera (o regenera) el token del agente local y pasa la balanza
// a modo agente. El token se devuelve una sola vez; en la DB queda solo el hash.
export const generarToken = async (req, res) => {
    try {
        const localidadId = await resolveLocalidadForWrite(req, req.body?.localidad_id);
        const token = generarTokenAgente();
        const result = await pool.query(`
            UPDATE configuracion_dispositivos
            SET modo_conexion = 'agente', agente_token_hash = $1, fecha_actualizacion = NOW()
            WHERE tipo_dispositivo = 'balanza' AND localidad_id = $2
            RETURNING id, localidad_id
        `, [hashToken(token), localidadId]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "La localidad no tiene balanza configurada" });
        }
        const { id } = result.rows[0];
        // El agente con el token viejo queda afuera
        expulsarAgente(id, 4401, 'Token regenerado');
        await reconectarBalanza(id);
        res.json({ success: true, data: { dispositivo_id: id, localidad_id: localidadId, token } });
    } catch (error) {
        sendScopeError(res, error);
    }
};

// DELETE /api/config/balanza/token — revoca el token y vuelve la balanza a modo directo
export const revocarToken = async (req, res) => {
    try {
        const localidadId = await resolveLocalidadForWrite(req, req.body?.localidad_id ?? req.query?.localidad_id);
        const result = await pool.query(`
            UPDATE configuracion_dispositivos
            SET modo_conexion = 'directo', agente_token_hash = NULL, fecha_actualizacion = NOW()
            WHERE tipo_dispositivo = 'balanza' AND localidad_id = $1
            RETURNING id
        `, [localidadId]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "La localidad no tiene balanza configurada" });
        }
        await reconectarBalanza(result.rows[0].id);   // cierra el agente (4410) y abre el TCP directo
        res.json({ success: true, data: { dispositivo_id: result.rows[0].id, modo_conexion: 'directo' } });
    } catch (error) {
        sendScopeError(res, error);
    }
};

// GET /api/config/balanzas — balanzas activas dentro del alcance, con estado de conexión
export const getBalanzas = async (req, res) => {
    try {
        const scope = scopeSql('cd.localidad_id', req.user, 1);
        const result = await pool.query(`
            SELECT cd.id, cd.localidad_id, l.nombre AS localidad_nombre,
                   cd.modo_conexion, cd.agente_ultima_conexion
            FROM configuracion_dispositivos cd
            JOIN localidad l ON l.id = cd.localidad_id
            WHERE cd.tipo_dispositivo = 'balanza' AND cd.activo = true
              AND ${scope.sql}
            ORDER BY l.nombre
        `, scope.params);
        const data = result.rows.map(row => {
            const estado = getEstadoBalanza(row.id);
            return {
                ...row,
                connected: estado?.connected ?? false,
                lastWeight: estado?.lastWeight ?? null,
                stable: estado?.stable ?? false,
                error: estado?.error ?? null,
                agente_online: estado?.agente_online ?? false,
            };
        });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
