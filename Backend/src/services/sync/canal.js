import crypto from 'crypto';

/**
 * Canal de mensajes JSON sobre un WebSocket, con pedidos/respuestas.
 *
 *  - Notificación:  { type, ...datos }                      → handler(msg), sin respuesta
 *  - Pedido:        { type, req_id, ...datos }              → handler(msg) → { type:'RESP', req_id, ok, data | error }
 *  - Respuesta:     { type:'RESP', req_id, ok, data, error } → resuelve el pedir() pendiente
 *
 * Los pedidos se procesan de a uno y en orden de llegada (los cambios de la réplica dependen
 * del orden). Respuestas y notificaciones no esperan la cola: así un handler que a su vez
 * pide algo al otro lado no se bloquea esperando su propia respuesta.
 */
export class Canal {
  constructor(ws, handlers, { nombre = 'canal', alCerrar } = {}) {
    this.ws = ws;
    this.handlers = handlers;
    this.nombre = nombre;
    this.pendientes = new Map();
    this.cola = Promise.resolve();
    this.cerrado = false;

    ws.on('message', (raw) => this.#recibir(raw));
    ws.on('close', () => {
      this.cerrado = true;
      this.#rechazarPendientes('Conexión cerrada');
      alCerrar?.();
    });
  }

  get abierto() {
    return !this.cerrado && this.ws.readyState === this.ws.OPEN;
  }

  enviar(type, datos = {}) {
    if (!this.abierto) return false;
    this.ws.send(JSON.stringify({ ...datos, type }));
    return true;
  }

  pedir(type, datos = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.abierto) return reject(new Error('Sin conexión'));
      const req_id = crypto.randomUUID();
      const timer = setTimeout(() => {
        this.pendientes.delete(req_id);
        reject(new Error(`Sin respuesta a ${type} (${Math.round(timeoutMs / 1000)} s)`));
      }, timeoutMs);
      this.pendientes.set(req_id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ ...datos, type, req_id }));
    });
  }

  #rechazarPendientes(motivo) {
    for (const [id, p] of this.pendientes) {
      clearTimeout(p.timer);
      p.reject(new Error(motivo));
      this.pendientes.delete(id);
    }
  }

  #recibir(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn(`⚠️  [${this.nombre}] mensaje no JSON ignorado`);
      return;
    }
    if (msg.type === 'RESP') {
      const p = this.pendientes.get(msg.req_id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pendientes.delete(msg.req_id);
      if (msg.ok) p.resolve(msg.data);
      else p.reject(Object.assign(new Error(msg.error || 'Error remoto'), { remoto: true, code: msg.code }));
      return;
    }
    const handler = this.handlers[msg.type];
    if (!handler) {
      console.warn(`⚠️  [${this.nombre}] tipo desconocido: ${msg.type}`);
      if (msg.req_id) this.#responder(msg.req_id, false, null, `Tipo desconocido: ${msg.type}`);
      return;
    }
    if (!msg.req_id) {
      Promise.resolve()
        .then(() => handler(msg))
        .catch(err => console.error(`❌ [${this.nombre}] ${msg.type}:`, err.message));
      return;
    }
    this.cola = this.cola.then(async () => {
      try {
        const data = await handler(msg);
        this.#responder(msg.req_id, true, data ?? null);
      } catch (err) {
        console.error(`❌ [${this.nombre}] ${msg.type}:`, err.message);
        this.#responder(msg.req_id, false, null, err.message, err.code);
      }
    });
  }

  #responder(req_id, ok, data, error, code) {
    if (!this.abierto) return;
    this.ws.send(JSON.stringify({ type: 'RESP', req_id, ok, data, error, code }));
  }
}
