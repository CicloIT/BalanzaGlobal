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
//                   { type:'NVR_RESULT', req_id, resultados:[{ canal, ok, jpg?(base64), bytes?, error? }] }
//                   (el agente solo envía después de recibir WELCOME)
// central → agente: { type:'WELCOME', dispositivo_id, localidad_id, config:{ ip, puerto } }
//                   { type:'CONFIG', config:{ ip, puerto } }  cuando se edita la balanza
//                   { type:'NVR_SNAPSHOTS', req_id, nvr:{ ip, puerto, usuario, password, marca },
//                     canales, timeout_ms, min_bytes }      fotos del NVR de la LAN del sitio (agente ≥ 0.2.0)
// La ip/puerto de la balanza y los datos de la grabadora vienen siempre de configuracion_dispositivos.

const PING_MS = 15000;
const ULTIMA_CONEXION_MS = 60000;
const NVR_VERSION_MIN = [0, 2, 0];
const NVR_MARGEN_MS = 5000;          // además del timeout que usa el agente con el NVR
const NVR_CONCURRENCIA = 8;          // el agente pide de a 8 canales a la vez (Agente/src/nvr.js)

// Pedidos al agente esperando respuesta: req_id → { ws, resolve, reject, timer }
const pendientes = new Map();

const versionMenor = (version, min) => {
    const partes = String(version || '0').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < min.length; i++) {
        if ((partes[i] ?? 0) !== min[i]) return (partes[i] ?? 0) < min[i];
    }
    return false;
};

const cerrarPendientes = (ws, motivo) => {
    for (const [id, p] of pendientes) {
        if (p.ws !== ws) continue;
        clearTimeout(p.timer);
        pendientes.delete(id);
        p.reject(new Error(motivo));
    }
};

// Pide al agente los snapshots de `canales` del NVR de su sitio.
// Resuelve [{ canal, buffer }] | [{ canal, error }] en el mismo orden que `canales`.
export const pedirSnapshotsAgente = (ws, nvr, canales, { timeoutMs = 15000, minBytes = 0 } = {}) =>
    new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== ws.OPEN) return reject(new Error('Agente del sitio desconectado'));
        if (versionMenor(ws.info?.version, NVR_VERSION_MIN)) {
            return reject(new Error(`Agente desactualizado (v${ws.info?.version ?? '?'}): las cámaras requieren v${NVR_VERSION_MIN.join('.')} o superior`));
        }
        const req_id = crypto.randomUUID();
        const tandas = Math.max(1, Math.ceil(canales.length / NVR_CONCURRENCIA));
        const timer = setTimeout(() => {
            pendientes.delete(req_id);
            reject(new Error('El agente no respondió a tiempo'));
        }, timeoutMs * tandas + NVR_MARGEN_MS);
        pendientes.set(req_id, {
            ws, timer, reject,
            resolve: (resultados) => {
                const porCanal = new Map((resultados || []).map(r => [Number(r.canal), r]));
                resolve(canales.map(canal => {
                    const r = porCanal.get(canal);
                    if (!r) return { canal, error: 'Sin respuesta del agente' };
                    if (!r.ok || !r.jpg) return { canal, error: r.error || 'Error desconocido' };
                    return { canal, buffer: Buffer.from(r.jpg, 'base64') };
                }));
            },
        });
        ws.send(JSON.stringify({
            type: 'NVR_SNAPSHOTS', req_id,
            nvr: { ip: nvr.ip, puerto: nvr.puerto ?? null, usuario: nvr.usuario, password: nvr.password, marca: nvr.marca },
            canales, timeout_ms: timeoutMs, min_bytes: minBytes,
        }));
    });

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
        case 'NVR_RESULT': {
            const p = pendientes.get(msg.req_id);
            if (!p || p.ws !== ws) break;
            clearTimeout(p.timer);
            pendientes.delete(msg.req_id);
            p.resolve(msg.resultados);
            break;
        }
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
            ws.on('close', () => {
                cerrarPendientes(ws, 'El agente se desconectó');
                detachAgent(disp.id, ws);
            });
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
