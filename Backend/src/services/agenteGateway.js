import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import pool from '../config/database.js';
import {
    attachAgent, detachAgent, ingestWeight, setStatus,
    getEstadoBalanza, getConfigBalanza, reconectarBalanza,
} from './balanzaService.js';

// ─── Canal WSS de los agentes locales (wss://host/agent) ─────────────────────
// Cada agente se autentica con el token de UNA balanza: el dispositivo sale del token,
// el agente nunca dice a qué balanza publica → no puede mezclar pesos con otro sitio.
//
// agente → central: { type:'HELLO', version, hostname }
//                   { type:'STATUS', connected, error? }     estado del TCP a la balanza
//                   { type:'WEIGHT', weight, stable }
//                   (el agente solo envía después de recibir WELCOME)
// central → agente: { type:'WELCOME', dispositivo_id, localidad_id, config:{ ip, puerto } }
//                   { type:'CONFIG', config:{ ip, puerto } }  cuando se edita la balanza
// La ip/puerto de la balanza vienen siempre de configuracion_dispositivos (vista Dispositivos).

const PING_MS = 15000;
const ULTIMA_CONEXION_MS = 60000;

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const generarTokenAgente = () => crypto.randomBytes(32).toString('base64url');

const tokenDeRequest = (req) => {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
    return new URL(req.url, 'http://localhost').searchParams.get('token');
};

const buscarDispositivo = async (token) => {
    if (!token) return null;
    const result = await pool.query(`
        SELECT id, localidad_id FROM configuracion_dispositivos
        WHERE agente_token_hash = $1 AND activo = true
          AND tipo_dispositivo = 'balanza' AND modo_conexion = 'agente'
    `, [hashToken(token)]);
    return result.rows[0] ?? null;
};

const registrarConexion = (dispositivoId, info) =>
    pool.query(`
        UPDATE configuracion_dispositivos
        SET agente_ultima_conexion = NOW(), agente_info = COALESCE($2::jsonb, agente_info)
        WHERE id = $1
    `, [dispositivoId, info ? JSON.stringify(info) : null])
        .catch(err => console.error('❌ No se pudo registrar la conexión del agente:', err.message));

const ipRemota = (req) =>
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

const procesarMensaje = (ws, raw) => {
    let msg;
    try {
        msg = JSON.parse(raw);
    } catch {
        console.warn(`⚠️  [agente balanza ${ws.dispositivoId}] mensaje no JSON ignorado`);
        return;
    }
    switch (msg.type) {
        case 'WEIGHT':
            if (typeof msg.weight === 'number') {
                ingestWeight(ws.dispositivoId, msg.weight, { stable: msg.stable === true });
            }
            break;
        case 'STATUS':
            setStatus(ws.dispositivoId, msg.connected === true, msg.error);
            break;
        case 'HELLO':
            ws.info = { ...ws.info, version: msg.version, hostname: msg.hostname };
            registrarConexion(ws.dispositivoId, ws.info);
            break;
        default:
            console.warn(`⚠️  [agente balanza ${ws.dispositivoId}] tipo desconocido: ${msg.type}`);
    }
};

export const crearAgenteGateway = () => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', async (ws, req) => {
        try {
            const disp = await buscarDispositivo(tokenDeRequest(req));
            if (!disp) {
                ws.close(4401, 'Token de agente inválido');
                return;
            }
            // Si la balanza se pasó a modo agente con el backend corriendo, recargarla
            if (getEstadoBalanza(disp.id)?.modo !== 'agente') await reconectarBalanza(disp.id);

            ws.dispositivoId = disp.id;
            ws.info = { ip: ipRemota(req) };
            if (!attachAgent(disp.id, ws)) {
                ws.close(4403, 'Balanza no habilitada en este servidor');
                return;
            }

            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });
            ws.on('message', (raw) => procesarMensaje(ws, raw));
            ws.on('close', () => detachAgent(disp.id, ws));
            ws.on('error', (err) => console.error(`❌ [agente balanza ${disp.id}] error:`, err.message));

            registrarConexion(disp.id, ws.info);
            ws.send(JSON.stringify({
                type: 'WELCOME',
                dispositivo_id: disp.id,
                localidad_id: disp.localidad_id,
                config: getConfigBalanza(disp.id),
            }));
        } catch (err) {
            console.error('❌ Error en conexión de agente:', err.message);
            ws.close(1011, 'Error interno');
        }
    });

    // Heartbeat: un agente que no responde el ping se da por caído
    const ping = setInterval(() => {
        wss.clients.forEach(ws => {
            if (ws.isAlive === undefined) return;   // todavía autenticando
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, PING_MS);

    const ultimaConexion = setInterval(() => {
        wss.clients.forEach(ws => ws.dispositivoId && registrarConexion(ws.dispositivoId));
    }, ULTIMA_CONEXION_MS);

    wss.on('close', () => {
        clearInterval(ping);
        clearInterval(ultimaConexion);
    });

    return wss;
};
