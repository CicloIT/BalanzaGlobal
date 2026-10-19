import net from 'net';
import pool from '../config/database.js';

// ─── Estado interno ───────────────────────────────────────────────────────────
// Una entrada por balanza (configuracion_dispositivos.id)
// { id, localidadId, ip, puerto, socket, buffer, lastWeight, connected, reconnectTimer, destroying }
const balanzas = new Map();
let broadcastFn = null;   // inyectado desde server.js

const RECONNECT_MS = 5000;
const RETRY_CONFIG_MS = 10000;

// ─── Protocolo ────────────────────────────────────────────────────────────────
// Trama: ":00|6893|000060|000000|000060|12"
// Índices: [0] status  [1] ID  [2] PESO  [3] TARA  [4] NETO  [5] checksum
// El peso está en el campo índice 2 (e.g. "000060" → 60 kg, o "-00020" → -20 kg)
export const parseFrame = (clean) => {
    const parts = clean.split('|').map(p => p.replace(/^:/, '').trim());
    const rawWeight = parts[2];
    return rawWeight !== undefined && /^-?\d+$/.test(rawWeight)
        ? parseInt(rawWeight, 10)
        : null;
};

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

// ─── Punto de entrada único para peso/estado ─────────────────────────────────
// Lo usa el socket TCP local; el agente remoto (WSS) usará los mismos.
export const ingestWeight = (dispositivoId, weight) => {
    const estado = balanzas.get(Number(dispositivoId));
    if (!estado || weight === null || weight === estado.lastWeight) return;
    estado.lastWeight = weight;
    broadcast(estado, { type: 'WEIGHT', weight, ts: Date.now() });
};

export const setStatus = (dispositivoId, connected, error) => {
    const estado = balanzas.get(Number(dispositivoId));
    if (!estado) return;
    estado.connected = connected;
    broadcast(estado, { type: 'STATUS', status: connected ? 'CONNECTED' : 'DISCONNECTED', ...(error && { error }) });
};

// ─── Socket TCP por balanza ───────────────────────────────────────────────────
const crearSocket = (estado) => {
    const socket = new net.Socket();

    socket.on('connect', () => {
        console.log(`✅ ${etiqueta(estado)} conectada en ${estado.ip}:${estado.puerto}`);
        setStatus(estado.id, true);
    });

    socket.on('data', (data) => {
        estado.buffer = Buffer.concat([estado.buffer, data]);
        let idx;
        while ((idx = estado.buffer.indexOf('\n')) !== -1) {
            const frame = estado.buffer.slice(0, idx + 1);
            estado.buffer = estado.buffer.slice(idx + 1);
            const clean = frame.toString('ascii').replace(/[\x02\x03\r]/g, '').trim();
            ingestWeight(estado.id, parseFrame(clean));
        }
    });

    socket.on('error', (err) => {
        console.error(`❌ ${etiqueta(estado)} error de conexión:`, err.message);
        setStatus(estado.id, false, err.message);
    });

    socket.on('close', () => {
        setStatus(estado.id, false);
        if (!estado.destroying && balanzas.get(estado.id) === estado) {
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
        SELECT id, ip, puerto, localidad_id
        FROM configuracion_dispositivos
        WHERE tipo_dispositivo = 'balanza' AND activo = true
          AND ($1::int IS NULL OR localidad_id = $1)
          AND ($2::int IS NULL OR id = $2)
        ORDER BY id
    `, [localidadEnv, dispositivoId]);
    return result.rows;
};

const registrar = (row) => {
    const estado = {
        id: row.id,
        localidadId: row.localidad_id,
        ip: row.ip,
        puerto: row.puerto ? parseInt(row.puerto, 10) : null,
        socket: null,
        buffer: Buffer.alloc(0),
        lastWeight: null,
        connected: false,
        reconnectTimer: null,
        destroying: false,
    };
    balanzas.set(row.id, estado);
    conectar(estado);
};

const cargarTodas = async () => {
    try {
        const rows = await obtenerConfigBalanzas();
        if (!rows.length) console.warn('⚠️ No hay balanzas activas configuradas en la base de datos');
        rows.forEach(registrar);
    } catch (err) {
        console.error('❌ No se pudo obtener la config de balanzas:', err.message);
        setTimeout(cargarTodas, RETRY_CONFIG_MS);
    }
};

// ─── Reconectar (llamado cuando se actualiza la config) ───────────────────────
export const reconectarBalanza = async (dispositivoId) => {
    const id = Number(dispositivoId);
    console.log(`🔄 Reconectando balanza ${id} con nueva configuración...`);
    const previo = balanzas.get(id);
    if (previo) {
        balanzas.delete(id);
        destruirSocket(previo);
    }
    const [row] = await obtenerConfigBalanzas(id);
    if (row) registrar(row);
    else if (previo) setStatus(id, false);   // quedó inactiva o fuera de LOCALIDAD_ID
};

// ─── Getters de estado ────────────────────────────────────────────────────────
const resumen = (estado) => ({
    dispositivo_id: estado.id,
    localidad_id: estado.localidadId,
    connected: estado.connected,
    lastWeight: estado.lastWeight,
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
