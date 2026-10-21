import net from 'net';
import pool from '../config/database.js';
import { parseFrame, cleanFrame, splitFrames, createStabilityTracker } from '../utils/balanzaProtocol.js';

// ─── Estado interno ───────────────────────────────────────────────────────────
// Una entrada por balanza (configuracion_dispositivos.id)
// { id, localidadId, ip, puerto, modo ('directo'|'agente'), socket, buffer, agentWs,
//   lastWeight, lastWeightTs, stable, historial, connected, error, reconnectTimer, destroying }
// modo 'directo': el backend abre el TCP a la balanza.
// modo 'agente':  un agente local del sitio lee la balanza y la publica por /agent (agenteGateway.js).
const balanzas = new Map();
let broadcastFn = null;   // inyectado desde server.js

const RECONNECT_MS = 5000;
const RETRY_CONFIG_MS = 10000;
const HISTORIAL_MS = 5 * 60 * 1000;   // cuánto se recuerdan las lecturas para validar pesadas

// ─── Helpers ──────────────────────────────────────────────────────────────────
const broadcast = (estado, msg) => {
    if (broadcastFn) broadcastFn({ ...msg, dispositivo_id: estado.id, localidad_id: estado.localidadId });
};

const cancelReconnect = (estado) => {
    if (estado.reconnectTimer) {
        clearTimeout(estado.reconnectTimer);
        estado.reconnectTimer = null;
    }
};

const destruirSocket = (estado) => {
    cancelReconnect(estado);
    if (estado.socket) {
        estado.destroying = true;
        estado.socket.destroy();
        estado.socket = null;
        estado.destroying = false;
    }
    estado.buffer = Buffer.alloc(0);
};

const etiqueta = (estado) => `[balanza ${estado.id} · loc ${estado.localidadId}]`;

const enviarAlAgente = (estado, msg) => {
    if (estado.agentWs?.readyState === estado.agentWs?.OPEN) estado.agentWs.send(JSON.stringify(msg));
};

// Tramos de peso leídos: { weight, desde, hasta }. Sirve para verificar que el peso
// de una pesada realmente lo marcó esa balanza (y no otra, ni uno tipeado).
const registrarHistorial = (estado, weight, ts) => {
    const ultimo = estado.historial[estado.historial.length - 1];
    if (ultimo && ultimo.weight === weight) ultimo.hasta = ts;
    else estado.historial.push({ weight, desde: ts, hasta: ts });
    const limite = ts - HISTORIAL_MS;
    while (estado.historial.length && estado.historial[0].hasta < limite) estado.historial.shift();
};

// ─── Punto de entrada único para peso/estado ─────────────────────────────────
// Lo usan el socket TCP local y el agente remoto (agenteGateway.js).
// `stable` lo informa el agente; en modo directo se calcula acá.
export const ingestWeight = (dispositivoId, weight, { stable } = {}) => {
    const estado = balanzas.get(Number(dispositivoId));
    if (!estado || weight === null || !Number.isFinite(weight)) return;
    const ts = Date.now();
    const esEstable = typeof stable === 'boolean' ? stable : estado.stability(weight, ts);
    registrarHistorial(estado, weight, ts);
    estado.lastWeightTs = ts;
    if (weight === estado.lastWeight && esEstable === estado.stable) return;
    estado.lastWeight = weight;
    estado.stable = esEstable;
    broadcast(estado, { type: 'WEIGHT', weight, stable: esEstable, ts });
};

export const setStatus = (dispositivoId, connected, error) => {
    const estado = balanzas.get(Number(dispositivoId));
    if (!estado) return;
    estado.connected = connected;
    estado.error = connected ? null : (error || null);
    if (!connected) estado.stable = false;
    broadcast(estado, { type: 'STATUS', status: connected ? 'CONNECTED' : 'DISCONNECTED', ...(estado.error && { error: estado.error }) });
};

// ¿La balanza marcó `peso` (± tolerancia) en los últimos `maxEdadMs`?
export const pesoLeidoRecientemente = (dispositivoId, peso, { maxEdadMs = 60000, toleranciaKg = 0 } = {}) => {
    const estado = balanzas.get(Number(dispositivoId));
    if (!estado) return false;
    const desde = Date.now() - maxEdadMs;
    return estado.historial.some(t => t.hasta >= desde && Math.abs(t.weight - peso) <= toleranciaKg);
};

// ─── Agente remoto ────────────────────────────────────────────────────────────
// Asocia la conexión WSS del agente a la balanza. Si ya había otro agente, lo reemplaza.
export const attachAgent = (dispositivoId, ws) => {
    const estado = balanzas.get(Number(dispositivoId));
    if (!estado || estado.modo !== 'agente') return false;
    if (estado.agentWs && estado.agentWs !== ws) {
        console.warn(`⚠️  ${etiqueta(estado)} otro agente tomó la balanza; se cierra la conexión anterior`);
        estado.agentWs.close(4409, 'Reemplazado por otra conexión del agente');
    }
    estado.agentWs = ws;
    console.log(`🛰️  ${etiqueta(estado)} agente conectado`);
    return true;
};

export const detachAgent = (dispositivoId, ws) => {
    const estado = balanzas.get(Number(dispositivoId));
    if (!estado || estado.agentWs !== ws) return;
    estado.agentWs = null;
    console.log(`🛰️  ${etiqueta(estado)} agente desconectado`);
    setStatus(estado.id, false, 'Agente desconectado');
};

export const getConfigBalanza = (dispositivoId) => {
    const estado = balanzas.get(Number(dispositivoId));
    return estado ? { ip: estado.ip, puerto: estado.puerto } : null;
};

// ─── Socket TCP por balanza (modo directo) ────────────────────────────────────
const crearSocket = (estado) => {
    const socket = new net.Socket();

    // Tras reconfigurar, el socket viejo puede emitir eventos tarde: ignorarlos
    const vigente = () => balanzas.get(estado.id) === estado;

    socket.on('connect', () => {
        if (!vigente()) return;
        console.log(`✅ ${etiqueta(estado)} conectada en ${estado.ip}:${estado.puerto}`);
        setStatus(estado.id, true);
    });

    socket.on('data', (data) => {
        const { frames, rest } = splitFrames(Buffer.concat([estado.buffer, data]));
        estado.buffer = rest;
        frames.forEach(frame => ingestWeight(estado.id, parseFrame(cleanFrame(frame))));
    });

    socket.on('error', (err) => {
        if (!vigente()) return;
        console.error(`❌ ${etiqueta(estado)} error de conexión:`, err.message);
        setStatus(estado.id, false, err.message);
    });

    socket.on('close', () => {
        if (!vigente()) return;
        setStatus(estado.id, false, estado.error);
        if (!estado.destroying) {
            console.log(`⚠️  ${etiqueta(estado)} conexión cerrada. Reintentando en ${RECONNECT_MS / 1000} s...`);
            cancelReconnect(estado);
            estado.reconnectTimer = setTimeout(() => conectar(estado), RECONNECT_MS);
        }
    });

    return socket;
};

const conectar = (estado) => {
    destruirSocket(estado);
    if (!estado.ip || !estado.puerto) {
        console.warn(`⚠️ ${etiqueta(estado)} sin IP/puerto configurado; no se conecta.`);
        setStatus(estado.id, false, 'IP o puerto no configurado');
        return;
    }
    estado.socket = crearSocket(estado);
    console.log(`📡 ${etiqueta(estado)} conectando a ${estado.ip}:${estado.puerto}...`);
    estado.socket.connect(estado.puerto, estado.ip);
};

// ─── Config desde la BD ───────────────────────────────────────────────────────
// LOCALIDAD_ID en .env limita a una localidad (instalación de un solo sitio)
const obtenerConfigBalanzas = async (dispositivoId = null) => {
    const localidadEnv = process.env.LOCALIDAD_ID ? parseInt(process.env.LOCALIDAD_ID, 10) : null;
    const result = await pool.query(`
        SELECT id, ip, puerto, localidad_id, modo_conexion
        FROM configuracion_dispositivos
        WHERE tipo_dispositivo = 'balanza' AND activo = true
          AND ($1::int IS NULL OR localidad_id = $1)
          AND ($2::int IS NULL OR id = $2)
        ORDER BY id
    `, [localidadEnv, dispositivoId]);
    return result.rows;
};

const registrar = (row, agentWsPrevio = null) => {
    const estado = {
        id: row.id,
        localidadId: row.localidad_id,
        ip: row.ip,
        puerto: row.puerto ? parseInt(row.puerto, 10) : null,
        modo: row.modo_conexion === 'agente' ? 'agente' : 'directo',
        socket: null,
        buffer: Buffer.alloc(0),
        agentWs: null,
        lastWeight: null,
        lastWeightTs: null,
        stable: false,
        stability: createStabilityTracker(),
        historial: [],
        connected: false,
        error: null,
        reconnectTimer: null,
        destroying: false,
    };
    balanzas.set(row.id, estado);

    if (estado.modo === 'directo') {
        if (agentWsPrevio) agentWsPrevio.close(4410, 'La balanza pasó a modo directo');
        conectar(estado);
        return;
    }
    // Modo agente: no se abre TCP; se espera (o se conserva) la conexión del agente
    if (agentWsPrevio) {
        estado.agentWs = agentWsPrevio;
        enviarAlAgente(estado, { type: 'CONFIG', config: { ip: estado.ip, puerto: estado.puerto } });
        setStatus(estado.id, false, 'Reconfigurando balanza');
    } else {
        console.log(`🛰️  ${etiqueta(estado)} en modo agente; esperando conexión del agente`);
        setStatus(estado.id, false, 'Agente desconectado');
    }
};

const cargarTodas = async () => {
    try {
        const rows = await obtenerConfigBalanzas();
        if (!rows.length) console.warn('⚠️ No hay balanzas activas configuradas en la base de datos');
        rows.forEach(row => registrar(row));
    } catch (err) {
        console.error('❌ No se pudo obtener la config de balanzas:', err.message);
        setTimeout(cargarTodas, RETRY_CONFIG_MS);
    }
};

// ─── Reconectar (llamado cuando se actualiza la config) ───────────────────────
export const reconectarBalanza = async (dispositivoId) => {
    const id = Number(dispositivoId);
    console.log(`🔄 Recargando balanza ${id} con nueva configuración...`);
    const previo = balanzas.get(id);
    if (previo) {
        balanzas.delete(id);
        destruirSocket(previo);
    }
    const [row] = await obtenerConfigBalanzas(id);
    if (row) {
        registrar(row, previo?.agentWs ?? null);
    } else if (previo) {
        // quedó inactiva o fuera de LOCALIDAD_ID
        previo.agentWs?.close(4403, 'Balanza inactiva');
        broadcast(previo, { type: 'STATUS', status: 'DISCONNECTED', error: 'Balanza inactiva' });
    }
};

// ─── Getters de estado ────────────────────────────────────────────────────────
const resumen = (estado) => ({
    dispositivo_id: estado.id,
    localidad_id: estado.localidadId,
    modo: estado.modo,
    agente_online: Boolean(estado.agentWs),
    connected: estado.connected,
    error: estado.error,
    lastWeight: estado.lastWeight,
    lastWeightTs: estado.lastWeightTs,
    stable: estado.stable,
    config: { ip: estado.ip, port: estado.puerto },
});

export const getEstadoBalanza = (dispositivoId) => {
    const estado = balanzas.get(Number(dispositivoId));
    return estado ? resumen(estado) : null;
};

export const getEstadosBalanzas = () => [...balanzas.values()].map(resumen);

// ─── Inicializar el servicio ──────────────────────────────────────────────────
export const inicializarBalanzas = (broadcastCallback) => {
    broadcastFn = broadcastCallback;
    cargarTodas();
};
