import net from 'net';
import pool from '../config/database.js';

// ─── Estado interno ───────────────────────────────────────────────────────────
let scaleBuffer = Buffer.alloc(0);
let lastWeight = null;
let isScaleConnected = false;
let client = null;
let reconnectTimer = null;
let broadcastFn = null;   // inyectado desde server.js
let currentIp = null;
let currentPort = null;
let currentDeviceId = null;
let destroying = false;   // para no reintentar si destruimos a propósito

// ─── Obtener config desde la BD ──────────────────────────────────────────────
const obtenerConfigBalanza = async () => {
    const localidadId = process.env.LOCALIDAD_ID ? parseInt(process.env.LOCALIDAD_ID) : null;
    const result = await pool.query(`
        SELECT id, ip, puerto
        FROM configuracion_dispositivos
        WHERE tipo_dispositivo = 'balanza' AND activo = true
          AND ($1::int IS NULL OR localidad_id = $1)
        LIMIT 1
    `, [localidadId]);
    if (!result.rows.length) throw new Error('No hay configuración de balanza en la base de datos');
    const { id, ip, puerto } = result.rows[0];
    if (!ip) throw new Error('La configuración de balanza no tiene IP definida');
    currentDeviceId = id;
    return { ip, puerto: puerto ? parseInt(puerto) : null };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const broadcast = (msg) => {
    if (broadcastFn) broadcastFn(msg);
};

const cancelReconnect = () => {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
};

// ─── Crear y conectar socket ──────────────────────────────────────────────────
const crearSocket = () => {
    const socket = new net.Socket();

    socket.on('connect', () => {
        console.log(`✅ Balanza conectada en ${currentIp}:${currentPort}`);
        isScaleConnected = true;
        broadcast({ type: 'STATUS', status: 'CONNECTED' });
    });

    socket.on('data', (data) => {
        scaleBuffer = Buffer.concat([scaleBuffer, data]);
        let idx;
        while ((idx = scaleBuffer.indexOf('\n')) !== -1) {
            const frame = scaleBuffer.slice(0, idx + 1);
            scaleBuffer = scaleBuffer.slice(idx + 1);
            const clean = frame.toString('ascii').replace(/[\x02\x03\r]/g, '').trim();
            console.log('⚖️  Valor crudo/limpio recibido via TCP:', clean);

            // Protocolo: ":00|6893|000060|000000|000060|12"
            // Índices:      [0]   [1]    [2]     [3]     [4]  [5]
            //               status  ID   PESO    TARA    NETO  checksum
            // Separamos por '|' y quitamos el ':' del primer campo
            const parts = clean.split('|').map(p => p.replace(/^:/, '').trim());
            console.log('⚖️  Campos parseados:', parts);

            // El peso siempre está en el campo índice 2 (e.g. "000060" → 60 kg, o "-00020" -> -20 kg)
            const rawWeight = parts[2];
            const weight = rawWeight !== undefined && /^-?\d+$/.test(rawWeight)
                ? parseInt(rawWeight, 10)
                : null;

            if (weight !== null && weight !== lastWeight) {
                lastWeight = weight;
                console.log('⚖️  Peso actualizado:', weight, 'kg');
                broadcast({ type: 'WEIGHT', weight, ts: Date.now() });
            }
        }
    });

    socket.on('error', (err) => {
        console.error('❌ Error en la conexión con la balanza:', err.message);
        isScaleConnected = false;
        broadcast({ type: 'STATUS', status: 'DISCONNECTED', error: err.message });
    });

    socket.on('close', () => {
        isScaleConnected = false;
        broadcast({ type: 'STATUS', status: 'DISCONNECTED' });
        if (!destroying) {
            console.log(`⚠️  Conexión con la balanza cerrada. Reintentando en 5 s...`);
            cancelReconnect();
            reconnectTimer = setTimeout(() => conectar(), 5000);
        }
    });

    return socket;
};

// ─── Conectar ─────────────────────────────────────────────────────────────────
const conectar = async () => {
    try {
        const { ip, puerto } = await obtenerConfigBalanza();
        currentIp = ip;
        currentPort = puerto;

        if (!puerto) {
            console.warn('⚠️ No hay puerto configurado para la balanza; no se puede conectar al socket TCP.');
            isScaleConnected = false;
            broadcast({ type: 'STATUS', status: 'DISCONNECTED', error: 'Puerto no configurado' });
            return;
        }

        // Destruir socket previo si existe
        if (client) {
            destroying = true;
            client.destroy();
            client = null;
            destroying = false;
        }
        cancelReconnect();

        client = crearSocket();
        console.log(`📡 Intentando conectar a la balanza en ${ip}:${puerto}...`);
        client.connect(puerto, ip);
    } catch (err) {
        console.error('❌ No se pudo obtener la config de la balanza:', err.message);
        // Reintentar en 10 s si falla la consulta a BD
        cancelReconnect();
        reconnectTimer = setTimeout(() => conectar(), 10000);
    }
};

// ─── Reconectar (llamado cuando se actualiza la config) ───────────────────────
export const reconectarBalanza = async () => {
    console.log('🔄 Reconectando balanza con nueva configuración...');
    destroying = true;
    if (client) {
        client.destroy();
        client = null;
    }
    destroying = false;
    cancelReconnect();
    scaleBuffer = Buffer.alloc(0);
    lastWeight = null;
    await conectar();
};

// ─── Getters de estado (para el health endpoint) ──────────────────────────────
export const getEstadoBalanza = () => ({
    connected: isScaleConnected,
    lastWeight,
    config: { ip: currentIp, port: currentPort }
});

export const getDispositivoIdBalanza = () => currentDeviceId;

// ─── Inicializar el servicio ──────────────────────────────────────────────────
export const inicializarBalanza = (broadcastCallback) => {
    broadcastFn = broadcastCallback;
    conectar();
};