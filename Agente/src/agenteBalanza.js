import net from 'net';
import WebSocket from 'ws';
import { parseFrame, cleanFrame, splitFrames, createStabilityTracker } from './balanzaProtocol.js';

const RECONNECT_BALANZA_MS = 5000;
const SIN_DATOS_MS = 5000;           // conectado al conversor pero sin tramas → balanza sin datos
const BACKOFF_MIN_MS = 1000;
const BACKOFF_MAX_MS = 30000;
const REEMPLAZADO_MS = 60000;        // otro agente usa el mismo token: esperar más antes de reintentar
const CENTRAL_SILENCIO_MS = 45000;   // el central hace ping cada 15 s
const MIN_ENVIO_MS = 200;            // máx ~5 mensajes/s por balanza
const KEEPALIVE_PESO_MS = 1000;      // reenviar el mismo peso para que el central sepa que sigue vigente

// En ECONNREFUSED con IPv4+IPv6 Node lanza un AggregateError con message vacío
const textoError = (err) => err.message || err.errors?.map(e => e.message).join(' / ') || err.code || String(err);

// Un agente por balanza: lee la balanza por TCP en la LAN y publica al central por WSS.
export class AgenteBalanza {
    constructor({ nombre, token, ip, puerto }, { sitio, central, headers = {}, version }) {
        this.etiqueta = `[${sitio} · ${nombre}]`;
        this.token = token;
        this.local = ip && puerto ? { ip, puerto: Number(puerto) } : null;   // override local de ip/puerto
        this.central = central;
        this.headers = headers;
        this.version = version;

        // Balanza (TCP)
        this.socket = null;
        this.buffer = Buffer.alloc(0);
        this.destino = null;              // { ip, puerto } en uso
        this.tcpConectado = false;
        this.sinDatos = true;
        this.errorBalanza = null;
        this.stability = createStabilityTracker();
        this.reconnectBalanzaTimer = null;
        this.watchdogTimer = null;

        // Último peso y envío
        this.peso = null;
        this.estable = false;
        this.ultimoEnvio = { weight: null, stable: null, ts: 0 };
        this.envioPendiente = null;

        // Central (WSS)
        this.ws = null;
        this.bienvenido = false;
        this.dispositivoId = null;
        this.backoff = BACKOFF_MIN_MS;
        this.reconnectCentralTimer = null;
        this.silencioTimer = null;
        this.detenido = false;
        this.avisoOffline = false;
    }

    log(...args) { console.log(new Date().toISOString(), this.etiqueta, ...args); }

    start() {
        if (this.local) this.conectarBalanza(this.local);
        this.conectarCentral();
    }

    stop() {
        this.detenido = true;
        clearTimeout(this.reconnectBalanzaTimer);
        clearTimeout(this.reconnectCentralTimer);
        clearTimeout(this.watchdogTimer);
        clearTimeout(this.silencioTimer);
        clearTimeout(this.envioPendiente);
        this.socket?.destroy();
        this.ws?.close(1000, 'Agente detenido');
    }

    // ─── Balanza ──────────────────────────────────────────────────────────────
    get balanzaOk() { return this.tcpConectado && !this.sinDatos; }

    conectarBalanza(destino) {
        clearTimeout(this.reconnectBalanzaTimer);
        if (this.socket) {
            const viejo = this.socket;
            this.socket = null;
            viejo.destroy();
        }
        this.destino = destino;
        this.buffer = Buffer.alloc(0);
        if (!destino?.ip || !destino?.puerto) {
            this.actualizarBalanza({ tcp: false, error: 'IP o puerto de balanza no configurado' });
            return;
        }

        const socket = new net.Socket();
        this.socket = socket;
        const vigente = () => this.socket === socket;
        this.log(`📡 conectando a balanza ${destino.ip}:${destino.puerto}...`);

        socket.on('connect', () => {
            if (!vigente()) return;
            this.log('✅ balanza conectada');
            this.actualizarBalanza({ tcp: true, error: null });
            this.armarWatchdog();
        });
        socket.on('data', (data) => {
            if (!vigente()) return;
            const { frames, rest } = splitFrames(Buffer.concat([this.buffer, data]));
            this.buffer = rest;
            for (const frame of frames) {
                const weight = parseFrame(cleanFrame(frame));
                if (weight === null) continue;
                this.armarWatchdog();
                if (this.sinDatos) this.actualizarBalanza({ sinDatos: false });
                this.peso = weight;
                this.estable = this.stability(weight);
                this.enviarPeso();
            }
        });
        socket.on('error', (err) => {
            if (!vigente()) return;
            this.log('❌ error balanza:', textoError(err));
            this.actualizarBalanza({ tcp: false, error: textoError(err) });
        });
        socket.on('close', () => {
            if (!vigente()) return;
            clearTimeout(this.watchdogTimer);
            this.actualizarBalanza({ tcp: false });
            if (this.detenido) return;
            this.log(`⚠️  conexión a balanza cerrada. Reintentando en ${RECONNECT_BALANZA_MS / 1000} s...`);
            this.reconnectBalanzaTimer = setTimeout(() => this.conectarBalanza(this.destino), RECONNECT_BALANZA_MS);
        });
        socket.connect(destino.puerto, destino.ip);
    }

    armarWatchdog() {
        clearTimeout(this.watchdogTimer);
        this.watchdogTimer = setTimeout(() => {
            this.log(`⚠️  sin tramas de la balanza hace ${SIN_DATOS_MS / 1000} s`);
            this.actualizarBalanza({ sinDatos: true, error: 'La balanza no envía datos' });
        }, SIN_DATOS_MS);
    }

    actualizarBalanza({ tcp, sinDatos, error }) {
        const antes = this.balanzaOk;
        const errorAntes = this.errorBalanza;
        if (tcp !== undefined) {
            this.tcpConectado = tcp;
            if (!tcp) this.sinDatos = true;
        }
        if (sinDatos !== undefined) this.sinDatos = sinDatos;
        if (error !== undefined) this.errorBalanza = error;
        if (this.balanzaOk) this.errorBalanza = null;
        if (!this.balanzaOk) this.estable = false;
        if (antes !== this.balanzaOk || errorAntes !== this.errorBalanza) this.enviarStatus();
    }

    // ─── Central ──────────────────────────────────────────────────────────────
    enviar(msg) {
        if (!this.bienvenido || this.ws?.readyState !== WebSocket.OPEN) return false;
        this.ws.send(JSON.stringify(msg));
        return true;
    }

    enviarStatus() {
        this.enviar({
            type: 'STATUS',
            connected: this.balanzaOk,
            ...(!this.balanzaOk && { error: this.errorBalanza || 'Balanza desconectada' }),
        });
    }

    // Envía si cambió peso/estabilidad (con límite de frecuencia) o cada KEEPALIVE_PESO_MS
    enviarPeso() {
        if (this.peso === null || !this.balanzaOk) return;
        const ahora = Date.now();
        const cambio = this.peso !== this.ultimoEnvio.weight || this.estable !== this.ultimoEnvio.stable;
        const desde = ahora - this.ultimoEnvio.ts;
        if (!cambio && desde < KEEPALIVE_PESO_MS) return;
        if (desde < MIN_ENVIO_MS) {
            if (!this.envioPendiente) {
                this.envioPendiente = setTimeout(() => { this.envioPendiente = null; this.enviarPeso(); }, MIN_ENVIO_MS - desde);
            }
            return;
        }
        if (this.enviar({ type: 'WEIGHT', weight: this.peso, stable: this.estable })) {
            this.ultimoEnvio = { weight: this.peso, stable: this.estable, ts: ahora };
        } else if (!this.avisoOffline) {
            this.avisoOffline = true;
            this.log('📴 sin conexión al central: los pesos se descartan hasta reconectar');
        }
    }

    armarSilencio() {
        clearTimeout(this.silencioTimer);
        this.silencioTimer = setTimeout(() => {
            this.log('⚠️  el central no responde; reconectando');
            this.ws?.terminate();
        }, CENTRAL_SILENCIO_MS);
    }

    conectarCentral() {
        if (this.detenido) return;
        this.log(`🌐 conectando al central ${this.central}...`);
        const ws = new WebSocket(this.central, {
            headers: { Authorization: `Bearer ${this.token}`, ...this.headers },
            handshakeTimeout: 15000,
        });
        this.ws = ws;
        let esperaExtra = 0;

        ws.on('open', () => this.armarSilencio());
        ws.on('ping', () => this.armarSilencio());
        ws.on('message', (raw) => {
            this.armarSilencio();
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }
            if (msg.type === 'WELCOME') this.alRecibirBienvenida(msg);
            else if (msg.type === 'CONFIG') this.alRecibirConfig(msg.config);
        });
        ws.on('unexpected-response', (req, res) => {
            this.log(`❌ el central respondió HTTP ${res.statusCode} al abrir el WebSocket (¿URL o headers del proxy?)`);
        });
        ws.on('error', (err) => this.log('❌ error con el central:', textoError(err)));
        ws.on('close', (code, reason) => {
            clearTimeout(this.silencioTimer);
            const eraBienvenido = this.bienvenido;
            this.bienvenido = false;
            if (this.ws !== ws || this.detenido) return;
            const motivo = reason?.toString() || '';
            if (code === 4401) this.log('⛔ token rechazado por el central:', motivo);
            else if (code === 4403) this.log('⛔ el central no habilita esta balanza:', motivo);
            else if (code === 4409) { this.log('⛔ otro agente se conectó con el mismo token:', motivo); esperaExtra = REEMPLAZADO_MS; }
            else if (code === 4410) this.log('ℹ️  la balanza pasó a modo directo en el central:', motivo);
            else if (eraBienvenido) this.log(`📴 desconectado del central (${code}${motivo ? ` ${motivo}` : ''})`);
            const espera = Math.max(this.backoff, esperaExtra);
            this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
            this.log(`↻ reintentando conexión al central en ${Math.round(espera / 1000)} s`);
            this.reconnectCentralTimer = setTimeout(() => this.conectarCentral(), espera);
        });
    }

    alRecibirBienvenida(msg) {
        this.bienvenido = true;
        this.avisoOffline = false;
        this.backoff = BACKOFF_MIN_MS;
        this.dispositivoId = msg.dispositivo_id;
        this.log(`🛰️  conectado al central → balanza ${msg.dispositivo_id} (localidad ${msg.localidad_id})`);
        this.enviar({ type: 'HELLO', version: this.version, hostname: process.env.COMPUTERNAME || process.env.HOSTNAME || null });
        this.enviarStatus();
        this.ultimoEnvio = { weight: null, stable: null, ts: 0 };
        this.enviarPeso();
        if (!this.local && !this.socket) this.alRecibirConfig(msg.config);
    }

    alRecibirConfig(config) {
        if (this.local) {
            this.log('ℹ️  el central mandó config de balanza, pero se usa la ip/puerto local del archivo de config');
            return;
        }
        const nuevo = { ip: config?.ip, puerto: config?.puerto ? Number(config.puerto) : null };
        if (this.socket && this.destino?.ip === nuevo.ip && this.destino?.puerto === nuevo.puerto) return;
        this.log(`⚙️  config de balanza del central: ${nuevo.ip}:${nuevo.puerto}`);
        this.conectarBalanza(nuevo);
    }
}
