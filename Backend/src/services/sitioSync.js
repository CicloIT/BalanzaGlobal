/**
 * Sitio: conexión saliente al central (CENTRAL_URL = wss://…/sitio, token SITIO_TOKEN).
 *
 *  1. HELLO → el central responde con el snapshot de sus tablas (usuarios, localidades,
 *     dispositivos…) y se aplica acá: así se puede entrar y pesar sin internet.
 *  2. Primera vez (base sin sync_estado.modo): bootstrap automático → baja todas las filas de
 *     la localidad, activa el outbox y las secuencias propias (sync_activar_sitio) y avisa
 *     BOOTSTRAP_FIN: desde ahí el central reenvía al sitio las escrituras de esta localidad.
 *  3. Sube el outbox en orden (CAMBIOS), y las capturas/PDF que le falten al central.
 *  4. Reenvía el peso en vivo de sus balanzas (WEIGHT/STATUS).
 *  5. Atiende RPC del central (escrituras de superadmin sobre datos de esta localidad).
 * Sin conexión todo sigue andando; el outbox se vacía al volver.
 */
import os from 'os';
import fs from 'fs';
import WebSocket from 'ws';
import pool from '../config/database.js';
import { centralUrl, sitioToken, localidadSitio, SYNC_SCHEMA, TABLAS_SITIO, TABLAS_CENTRAL } from '../config/modo.js';
import { Canal } from './sync/canal.js';
import {
  upsertFila, existeArchivo, leerArchivoB64, guardarArchivoB64, archivosFaltantesDeLocalidad,
} from './sync/replica.js';
import { ejecutarLocal } from './sync/rpcLocal.js';
import { reconectarBalanza, getEstadosBalanzas } from './balanzaService.js';

const VERSION = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
const LOTE = 200;
const REVISION_OUTBOX_MS = 2000;
const RECONEXION_MIN_MS = 2000;
const RECONEXION_MAX_MS = 60000;

const estado = {
  canal: null,
  conectado: false,
  activo: false,          // la base ya es de sitio (sync_estado.modo)
  sitioActivoCentral: false,
  ultimaSync: null,
  ultimoError: null,
  bootstrap: null,        // texto de progreso mientras corre
};

let ws = null;
let espera = RECONEXION_MIN_MS;
let reconexionTimer = null;
let detenido = false;

// ─── Estado local ─────────────────────────────────────────────────────────────
const leerModoLocal = async () => {
  const r = await pool.query(`SELECT valor FROM sync_estado WHERE clave = 'modo'`);
  return r.rows[0]?.valor ?? null;
};

const guardarEstado = (clave, valor) =>
  pool.query(
    `INSERT INTO sync_estado (clave, valor) VALUES ($1, $2::jsonb)
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = now()`,
    [clave, JSON.stringify(valor)]
  ).catch(err => console.error('❌ [sync] no se pudo guardar estado:', err.message));

/** ¿Este servidor ya puede escribir datos de la localidad? (bootstrap terminado) */
export const sitioListo = () => estado.activo;

export const estadoSync = async () => {
  const r = await pool.query('SELECT COUNT(*)::int AS n, MIN(creado) AS desde FROM sync_outbox');
  return {
    modo: 'sitio',
    localidad_id: localidadSitio(),
    conectado: estado.conectado,
    listo: estado.activo,
    pendientes: r.rows[0].n,
    pendientes_desde: r.rows[0].desde,
    ultima_sync: estado.ultimaSync,
    ultimo_error: estado.ultimoError,
    bootstrap: estado.bootstrap,
  };
};

// ─── Snapshot del central ─────────────────────────────────────────────────────
const BALANZA_CAMPOS = ['ip', 'puerto', 'activo', 'tipo_dispositivo', 'localidad_id'];
const firmaBalanza = (f) => JSON.stringify(BALANZA_CAMPOS.map(c => f?.[c] ?? null));

const aplicarSnapshot = async (tablas) => {
  const antes = await pool.query(
    `SELECT id, to_jsonb(t) AS fila FROM configuracion_dispositivos t WHERE tipo_dispositivo = 'balanza'`);
  const firmasAntes = new Map(antes.rows.map(r => [r.id, firmaBalanza(r.fila)]));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const tabla of TABLAS_CENTRAL) {
      for (const fila of tablas?.[tabla] || []) await upsertFila(client, tabla, fila);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // Balanzas nuevas o con ip/puerto/activo cambiados: reconectar
  for (const fila of tablas?.configuracion_dispositivos || []) {
    if (fila.tipo_dispositivo !== 'balanza') continue;
    if (firmasAntes.get(fila.id) !== firmaBalanza(fila)) {
      await reconectarBalanza(fila.id).catch(err => console.error(`❌ [sync] balanza ${fila.id}:`, err.message));
    }
  }
};

// ─── Bootstrap (primera conexión) ─────────────────────────────────────────────
const bootstrap = async (canal) => {
  const L = localidadSitio();
  console.log(`📥 [sync] base nueva: bajando datos de la localidad ${L} del central...`);
  for (const tabla of TABLAS_SITIO) {
    let despues = 0;
    let total = 0;
    for (;;) {
      estado.bootstrap = `${tabla}: ${total} filas`;
      const pagina = await canal.pedir('BOOTSTRAP', { tabla, despues }, 120000);
      if (pagina.filas.length) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SET CONSTRAINTS ALL DEFERRED');
          for (const fila of pagina.filas) await upsertFila(client, tabla, fila);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw new Error(`bootstrap ${tabla}: ${err.message}`);
        } finally {
          client.release();
        }
      }
      total += pagina.filas.length;
      if (pagina.fin || pagina.ultimo === null) break;
      despues = pagina.ultimo;
    }
    console.log(`   ${tabla}: ${total}`);
  }
  await pool.query('SELECT sync_activar_sitio($1)', [L]);
  estado.activo = true;
  await canal.pedir('BOOTSTRAP_FIN', {});
  estado.sitioActivoCentral = true;
  estado.bootstrap = null;
  console.log('✅ [sync] sitio activado: outbox y secuencias propias listas');
};

// Capturas/PDF viejos que el sitio no tiene (bajan del central, en segundo plano)
const bajarArchivosFaltantes = async (canal) => {
  const faltan = await archivosFaltantesDeLocalidad(pool, localidadSitio());
  if (!faltan.length) return;
  console.log(`📥 [sync] bajando ${faltan.length} archivo(s) del central...`);
  for (const clave of faltan) {
    if (!canal.abierto) return;
    try {
      const { b64 } = await canal.pedir('ARCHIVO_GET', { clave }, 60000);
      if (b64) guardarArchivoB64(clave, b64);
    } catch (err) {
      console.warn(`⚠️  [sync] no se pudo bajar ${clave}: ${err.message}`);
    }
  }
};

// ─── Subida del outbox ────────────────────────────────────────────────────────
const subirArchivos = async (canal, claves) => {
  for (const clave of claves || []) {
    if (!existeArchivo(clave)) {
      console.warn(`⚠️  [sync] el central pide ${clave} pero no está en este servidor`);
      continue;
    }
    await canal.pedir('ARCHIVO', { clave, b64: leerArchivoB64(clave) }, 120000);
  }
};

let subiendo = null;
let repetir = false;

/** Sube todo el outbox pendiente. Si ya hay una subida en curso, la vuelve a correr al terminar. */
export const enviarPendientes = () => {
  if (subiendo) {
    repetir = true;
    return subiendo;
  }
  subiendo = (async () => {
    do {
      repetir = false;
      await subirOutbox();
    } while (repetir);
  })().finally(() => { subiendo = null; });
  return subiendo;
};

const subirOutbox = async () => {
  const canal = estado.canal;
  if (!estado.activo || !estado.sitioActivoCentral || !canal?.abierto) return;
  for (;;) {
    const r = await pool.query('SELECT id, tabla, op, pk, fila FROM sync_outbox ORDER BY id LIMIT $1', [LOTE]);
    if (!r.rows.length) return;
    const items = r.rows.map(x => ({ outbox_id: Number(x.id), tabla: x.tabla, op: x.op, pk: x.pk, fila: x.fila }));
    try {
      const { hasta, faltan } = await canal.pedir('CAMBIOS', { items }, 120000);
      await subirArchivos(canal, faltan);
      await pool.query('DELETE FROM sync_outbox WHERE id <= $1', [hasta]);
      estado.ultimaSync = new Date().toISOString();
      if (estado.ultimoError) {
        estado.ultimoError = null;
        guardarEstado('ultimo_error', null);
      }
    } catch (err) {
      estado.ultimoError = { mensaje: err.message, at: new Date().toISOString() };
      guardarEstado('ultimo_error', estado.ultimoError);
      console.error('❌ [sync] el central rechazó cambios:', err.message);
      return;   // se reintenta en la próxima revisión
    }
    if (r.rows.length < LOTE) return;
  }
};

// ─── Peso en vivo ─────────────────────────────────────────────────────────────
/** Lo llama server.js con cada mensaje de balanza (WEIGHT / STATUS). */
export const reenviarBalanza = (msg) => {
  const canal = estado.canal;
  if (!canal?.abierto || !msg?.dispositivo_id) return;
  if (msg.type === 'WEIGHT') {
    canal.enviar('WEIGHT', { dispositivo_id: msg.dispositivo_id, weight: msg.weight, stable: msg.stable });
  } else if (msg.type === 'STATUS') {
    canal.enviar('STATUS', { dispositivo_id: msg.dispositivo_id, connected: msg.status === 'CONNECTED', error: msg.error });
  }
};

const enviarEstadoBalanzas = (canal) => {
  for (const e of getEstadosBalanzas()) {
    canal.enviar('STATUS', { dispositivo_id: e.dispositivo_id, connected: e.connected, error: e.error });
    if (e.lastWeight !== null) canal.enviar('WEIGHT', { dispositivo_id: e.dispositivo_id, weight: e.lastWeight, stable: e.stable });
  }
};

// ─── RPC ──────────────────────────────────────────────────────────────────────
/** Reenvía al central un request de este servidor (p. ej. cambio de contraseña). */
export const rpcCentral = async (rpc) => {
  if (!estado.canal?.abierto) {
    throw Object.assign(new Error('Sin conexión con el servidor central; reintente cuando vuelva internet'), { code: 'CENTRAL_OFFLINE' });
  }
  return estado.canal.pedir('RPC', rpc, 45000);
};

const handlers = {
  SNAPSHOT: async (msg) => {
    await aplicarSnapshot(msg.tablas);
    return { ok: true };
  },
  // Escritura de un superadmin desde el central sobre datos de esta localidad
  RPC: async (msg) => {
    if (!estado.activo) throw new Error('El sitio todavía se está inicializando');
    const resultado = await ejecutarLocal(msg);
    await enviarPendientes();   // que el central ya tenga el cambio cuando reciba la respuesta
    return resultado;
  },
};

// ─── Conexión ─────────────────────────────────────────────────────────────────
const alConectar = async (canal) => {
  const L = localidadSitio();
  const hola = await canal.pedir('HELLO', { version: VERSION, schema: SYNC_SCHEMA, info: { hostname: os.hostname() } }, 60000);
  if (hola.localidad_id !== L) {
    throw Object.assign(new Error(`El token es de la localidad ${hola.localidad_id} pero LOCALIDAD_ID=${L}`), { fatal: true });
  }
  await aplicarSnapshot(hola.snapshot);
  estado.sitioActivoCentral = hola.sitio_activo;

  const modo = await leerModoLocal();
  if (modo && modo.localidad_id !== L) {
    throw Object.assign(new Error(`Esta base es del sitio ${modo.localidad_id} pero LOCALIDAD_ID=${L}`), { fatal: true });
  }
  if (!modo) {
    await bootstrap(canal);
  } else {
    estado.activo = true;
    if (!hola.sitio_activo) {
      await canal.pedir('BOOTSTRAP_FIN', {});
      estado.sitioActivoCentral = true;
    }
  }

  enviarEstadoBalanzas(canal);
  await enviarPendientes();
  // Archivos pendientes en ambos sentidos, sin bloquear
  canal.pedir('FALTANTES', {}, 60000)
    .then(faltan => subirArchivos(canal, faltan))
    .then(() => bajarArchivosFaltantes(canal))
    .catch(err => console.warn('⚠️  [sync] archivos:', err.message));
};

const programarReconexion = () => {
  if (detenido) return;
  clearTimeout(reconexionTimer);
  reconexionTimer = setTimeout(conectar, espera);
  espera = Math.min(espera * 2, RECONEXION_MAX_MS);
};

const conectar = () => {
  if (detenido) return;
  ws = new WebSocket(centralUrl(), {
    headers: { Authorization: `Bearer ${sitioToken()}` },
    maxPayload: 64 * 1024 * 1024,
    handshakeTimeout: 15000,
  });

  const canal = new Canal(ws, handlers, {
    nombre: 'central',
    alCerrar: () => {
      if (estado.canal === canal) {
        estado.canal = null;
        estado.conectado = false;
      }
      programarReconexion();
    },
  });

  ws.on('open', async () => {
    console.log(`🌐 [sync] conectado al central ${centralUrl()}`);
    estado.canal = canal;
    estado.conectado = true;
    espera = RECONEXION_MIN_MS;
    try {
      await alConectar(canal);
    } catch (err) {
      estado.ultimoError = { mensaje: err.message, at: new Date().toISOString() };
      console.error(`❌ [sync] ${err.message}`);
      if (err.fatal) {
        detenido = true;
        console.error('❌ [sync] sincronización detenida: corregir el .env y reiniciar');
      }
      ws.close();
    }
  });
  ws.on('unexpected-response', (req, res) => {
    estado.ultimoError = { mensaje: `El central respondió HTTP ${res.statusCode}`, at: new Date().toISOString() };
  });
  ws.on('close', (code, reason) => {
    if (code === 4401) {
      estado.ultimoError = { mensaje: `Token de sitio rechazado: ${reason}`, at: new Date().toISOString() };
      console.error(`❌ [sync] ${estado.ultimoError.mensaje}`);
    }
  });
  ws.on('error', (err) => {
    if (!estado.conectado) console.warn(`⚠️  [sync] sin conexión con el central (${err.message}); reintento en ${Math.round(espera / 1000)} s`);
  });
};

export const iniciarSitioSync = async () => {
  try {
    estado.activo = Boolean(await leerModoLocal());
  } catch (err) {
    console.error('❌ [sync] falta aplicar migration_v2_sitio.sql en la base del sitio:', err.message);
    return;
  }
  console.log(`🏠 Modo sitio · localidad ${localidadSitio()} · central ${centralUrl()}${estado.activo ? '' : ' · pendiente de inicializar'}`);
  setInterval(() => { enviarPendientes().catch(() => {}); }, REVISION_OUTBOX_MS);
  conectar();
};
