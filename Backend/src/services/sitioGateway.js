/**
 * Central: canal WSS de los servidores de sitio (wss://host/sitio).
 *
 * Cada sitio se autentica con el token de SU localidad (localidad.sitio_token_hash): la
 * localidad sale del token, nunca de lo que diga el sitio. Solo puede subir filas de esa
 * localidad.
 *
 * sitio → central (pedidos, ver services/sync/canal.js):
 *   HELLO {version, schema, info}         → {localidad_id, sitio_activo}
 *   CAMBIOS {items:[{outbox_id, tabla, op, pk, fila}]} → {hasta, faltan:[claves de archivos]}
 *   ARCHIVO {clave, b64}                  sube una captura/PDF que el central no tiene
 *   FALTANTES                             → [claves] archivos de la localidad que le faltan al central
 *   ARCHIVO_GET {clave}                   → {b64} (bootstrap: el sitio baja archivos viejos)
 *   BOOTSTRAP {tabla, despues}            → {filas, ultimo}  filas de la localidad, paginadas
 *   BOOTSTRAP_FIN                         activa el sitio (desde ahí el central reenvía escrituras)
 *   RPC {method, path, user_id, body}     → {status, body}  (solo cambio de contraseña propia)
 * sitio → central (notificaciones): WEIGHT / STATUS {dispositivo_id, …}  peso en vivo
 * central → sitio (pedidos): SNAPSHOT {tablas}  ·  RPC {method, path, user_id, …}
 */
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import pool from '../config/database.js';
import { SYNC_SCHEMA, TABLAS_SITIO } from '../config/modo.js';
import { Canal } from './sync/canal.js';
import {
  upsertFila, borrarFila, localidadDeFila, localidadExistente, pkDe,
  archivosDeFila, existeArchivo, guardarArchivoB64, leerArchivoB64,
  archivosFaltantesDeLocalidad, archivoEsDeLocalidad,
} from './sync/replica.js';
import { ejecutarLocal } from './sync/rpcLocal.js';
import { ingestWeight, setStatus, localidadDeBalanza, reconectarBalanzasDeLocalidad } from './balanzaService.js';

const PING_MS = 15000;
const SNAPSHOT_REVISION_MS = 30000;
const BOOTSTRAP_PAGINA = 1000;

// localidadId → { canal, ws, info, hashSnapshot }
const sitios = new Map();

export const hashTokenSitio = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const generarTokenSitio = () => crypto.randomBytes(32).toString('base64url');

export const sitioConectado = (localidadId) => Boolean(sitios.get(Number(localidadId))?.canal.abierto);

export const estadoSitios = () => [...sitios.entries()].map(([localidad_id, s]) => ({
  localidad_id, conectado: s.canal.abierto, info: s.info,
}));

/** Cierra la conexión del sitio (al regenerar/revocar su token). */
export const expulsarSitio = (localidadId, motivo = 'Token revocado') => {
  sitios.get(Number(localidadId))?.ws.close(4401, motivo);
};

/** Reenvía un request al servidor de la localidad. Lanza si no está conectado. */
export const pedirRpcSitio = async (localidadId, rpc, timeoutMs = 45000) => {
  const s = sitios.get(Number(localidadId));
  if (!s?.canal.abierto) {
    throw Object.assign(new Error('El servidor de la localidad está sin conexión; reintente cuando vuelva'), { code: 'SITIO_OFFLINE' });
  }
  return s.canal.pedir('RPC', rpc, timeoutMs);
};

// ─── Snapshot de datos del central para un sitio ─────────────────────────────
const filas = async (sql, params = []) => (await pool.query(sql, params)).rows.map(r => r.fila);

export const construirSnapshot = async (localidadId) => {
  const loc = await pool.query('SELECT empresa_id FROM localidad WHERE id = $1', [localidadId]);
  if (!loc.rows.length) throw new Error(`Localidad ${localidadId} inexistente`);
  const empresaId = loc.rows[0].empresa_id;
  return {
    provincia: await filas('SELECT to_jsonb(t) AS fila FROM provincia t ORDER BY id'),
    empresa: await filas('SELECT to_jsonb(t) AS fila FROM empresa t WHERE id = $1', [empresaId]),
    empresa_config: await filas('SELECT to_jsonb(t) AS fila FROM empresa_config t WHERE empresa_id = $1', [empresaId]),
    localidad: await filas(
      `SELECT to_jsonb(t) - 'sitio_token_hash' AS fila FROM localidad t WHERE empresa_id = $1 ORDER BY id`, [empresaId]),
    usuario: await filas(
      'SELECT to_jsonb(t) AS fila FROM usuario t WHERE empresa_id = $1 OR empresa_id IS NULL ORDER BY id', [empresaId]),
    configuracion_dispositivos: await filas(
      `SELECT to_jsonb(t) - 'agente_token_hash' AS fila FROM configuracion_dispositivos t WHERE localidad_id = $1 ORDER BY id`,
      [localidadId]),
  };
};

const hashDe = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');

const enviarSnapshot = async (localidadId, { forzar = false } = {}) => {
  const s = sitios.get(localidadId);
  if (!s?.canal.abierto) return;
  const tablas = await construirSnapshot(localidadId);
  const hash = hashDe(tablas);
  if (!forzar && hash === s.hashSnapshot) return;
  await s.canal.pedir('SNAPSHOT', { tablas }, 60000);
  s.hashSnapshot = hash;
};

let avisoTimer = null;
/** Algo cambió en usuarios/localidades/config: mandar snapshot a los sitios (con rebote de 1 s). */
export const avisarCambioCentral = () => {
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => {
    for (const id of sitios.keys()) {
      enviarSnapshot(id).catch(err => console.error(`❌ [sitio ${id}] snapshot:`, err.message));
    }
  }, 1000);
};

// ─── Aplicar cambios que suben del sitio ─────────────────────────────────────
const aplicarCambios = async (localidadId, items) => {
  if (!Array.isArray(items) || !items.length) return { hasta: null, faltan: [] };
  const client = await pool.connect();
  const referencias = new Set();
  let hasta = null;
  try {
    await client.query('BEGIN');
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    for (const it of items) {
      const { outbox_id, tabla, op, pk, fila } = it;
      const donde = `outbox ${outbox_id} (${tabla} ${op} ${JSON.stringify(pk)})`;
      if (!TABLAS_SITIO.includes(tabla)) throw new Error(`${donde}: tabla no replicable`);
      for (const c of pkDe(tabla)) if (pk?.[c] === undefined) throw new Error(`${donde}: falta pk`);

      const existente = await localidadExistente(client, tabla, pk);
      if (existente !== undefined && existente !== localidadId) {
        throw new Error(`${donde}: la fila pertenece a otra localidad (${existente})`);
      }
      if (op === 'D') {
        if (existente !== undefined) await borrarFila(client, tabla, pk);
      } else {
        const nueva = await localidadDeFila(client, tabla, fila || {});
        if (nueva !== localidadId) throw new Error(`${donde}: localidad ${nueva} no es la del sitio`);
        await upsertFila(client, tabla, fila);
        archivosDeFila(tabla, fila).forEach(c => referencias.add(c));
      }
      hasta = outbox_id;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await pool.query('UPDATE localidad SET sitio_ultima_sync = NOW() WHERE id = $1', [localidadId]);
  return { hasta, faltan: [...referencias].filter(c => !existeArchivo(c)) };
};

// ─── Bootstrap: filas de la localidad, paginadas por pk ──────────────────────
const SQL_BOOTSTRAP = {
  pesada: `SELECT to_jsonb(t) AS fila, t.id AS orden FROM pesada t
           JOIN operacion_pesaje o ON o.id = t.operacion_id
           WHERE o.localidad_id = $1 AND t.id > $2 ORDER BY t.id LIMIT $3`,
  solicitud_borrado_operacion: `SELECT to_jsonb(t) AS fila, t.solicitud_id AS orden FROM solicitud_borrado_operacion t
           JOIN solicitud_borrado s ON s.id = t.solicitud_id
           WHERE s.localidad_id = $1 AND t.solicitud_id > $2 ORDER BY t.solicitud_id LIMIT $3`,
};
const sqlBootstrap = (tabla) => SQL_BOOTSTRAP[tabla]
  ?? `SELECT to_jsonb(t) AS fila, t.id AS orden FROM "${tabla}" t WHERE t.localidad_id = $1 AND t.id > $2 ORDER BY t.id LIMIT $3`;

const paginaBootstrap = async (localidadId, tabla, despues) => {
  if (!TABLAS_SITIO.includes(tabla)) throw new Error(`Tabla no replicable: ${tabla}`);
  // solicitud_borrado_operacion pagina por solicitud entera (una solicitud cabe en una página)
  const limite = tabla === 'solicitud_borrado_operacion' ? 1000000 : BOOTSTRAP_PAGINA;
  const r = await pool.query(sqlBootstrap(tabla), [localidadId, Number(despues) || 0, limite]);
  return {
    filas: r.rows.map(x => x.fila),
    ultimo: r.rows.length ? r.rows[r.rows.length - 1].orden : null,
    fin: tabla === 'solicitud_borrado_operacion' || r.rows.length < BOOTSTRAP_PAGINA,
  };
};

// ─── RPC sitio → central (lista cerrada) ─────────────────────────────────────
const RPC_PERMITIDOS = [{ method: 'PUT', path: /^\/api\/usuarios\/me\/password$/ }];

const rpcDesdeSitio = async (localidadId, rpc) => {
  if (!RPC_PERMITIDOS.some(p => p.method === rpc.method && p.path.test(rpc.path))) {
    throw new Error('Operación no permitida desde un sitio');
  }
  // El usuario tiene que poder entrar en ese sitio: de su empresa (o superadmin)
  const r = await pool.query(
    `SELECT 1 FROM usuario u, localidad l
     WHERE u.id = $1 AND l.id = $2 AND u.activo AND (u.empresa_id = l.empresa_id OR u.empresa_id IS NULL)`,
    [rpc.user_id, localidadId]
  );
  if (!r.rows.length) throw new Error('Usuario no válido para este sitio');
  const resultado = await ejecutarLocal(rpc);
  avisarCambioCentral();
  return resultado;
};

// ─── Conexiones ───────────────────────────────────────────────────────────────
const tokenDeRequest = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
};

const buscarLocalidad = async (token) => {
  if (!token) return null;
  const r = await pool.query(
    'SELECT id, nombre, sitio_activo FROM localidad WHERE sitio_token_hash = $1', [hashTokenSitio(token)]);
  return r.rows[0] ?? null;
};

const registrarInfo = (localidadId, info) =>
  pool.query('UPDATE localidad SET sitio_info = $2::jsonb WHERE id = $1', [localidadId, JSON.stringify(info)])
    .catch(err => console.error(`❌ [sitio ${localidadId}] no se pudo guardar sitio_info:`, err.message));

const handlersPara = (loc, estado) => {
  const L = loc.id;
  const balanzaPropia = (id) => localidadDeBalanza(id) === L;
  return {
    HELLO: async (msg) => {
      if (msg.schema !== SYNC_SCHEMA) {
        throw new Error(`Versión de sincronización incompatible (sitio ${msg.schema}, central ${SYNC_SCHEMA}): actualizar la app`);
      }
      estado.info = { version: msg.version, hostname: msg.info?.hostname, ip: estado.ip, conectado_desde: new Date().toISOString() };
      registrarInfo(L, estado.info);
      const r = await pool.query('SELECT sitio_activo FROM localidad WHERE id = $1', [L]);
      // El snapshot va en la respuesta: el sitio lo aplica antes del bootstrap (usuarios, dispositivos…)
      const snapshot = await construirSnapshot(L);
      estado.hashSnapshot = hashDe(snapshot);
      return { localidad_id: L, sitio_activo: r.rows[0]?.sitio_activo ?? false, snapshot };
    },
    CAMBIOS: (msg) => aplicarCambios(L, msg.items),
    ARCHIVO: async (msg) => {
      if (!(await archivoEsDeLocalidad(pool, L, msg.clave))) throw new Error(`Archivo ajeno a la localidad: ${msg.clave}`);
      guardarArchivoB64(msg.clave, msg.b64);
      return { ok: true };
    },
    FALTANTES: () => archivosFaltantesDeLocalidad(pool, L),
    ARCHIVO_GET: async (msg) => {
      if (!(await archivoEsDeLocalidad(pool, L, msg.clave))) throw new Error(`Archivo ajeno a la localidad: ${msg.clave}`);
      return { b64: leerArchivoB64(msg.clave) };
    },
    BOOTSTRAP: (msg) => paginaBootstrap(L, msg.tabla, msg.despues),
    BOOTSTRAP_FIN: async () => {
      await pool.query('UPDATE localidad SET sitio_activo = true, sitio_ultima_sync = NOW() WHERE id = $1', [L]);
      await reconectarBalanzasDeLocalidad(L);
      console.log(`🏠 [sitio ${L} · ${loc.nombre}] activado: el central reenvía las escrituras de esta localidad`);
      return { sitio_activo: true };
    },
    RPC: (msg) => rpcDesdeSitio(L, msg),
    WEIGHT: (msg) => {
      if (balanzaPropia(msg.dispositivo_id) && typeof msg.weight === 'number') {
        ingestWeight(msg.dispositivo_id, msg.weight, { stable: msg.stable === true });
      }
    },
    STATUS: (msg) => {
      if (balanzaPropia(msg.dispositivo_id)) setStatus(msg.dispositivo_id, msg.connected === true, msg.error);
    },
  };
};

const marcarBalanzasDesconectadas = async (localidadId) => {
  const r = await pool.query(
    `SELECT id FROM configuracion_dispositivos WHERE tipo_dispositivo = 'balanza' AND localidad_id = $1`, [localidadId]);
  r.rows.forEach(({ id }) => setStatus(id, false, 'Servidor de la localidad desconectado'));
};

export const crearSitioGateway = () => {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 * 1024 });

  wss.on('connection', async (ws, req) => {
    try {
      const loc = await buscarLocalidad(tokenDeRequest(req));
      if (!loc) {
        ws.close(4401, 'Token de sitio inválido');
        return;
      }
      const previo = sitios.get(loc.id);
      if (previo) previo.ws.close(4409, 'Reemplazado por otra conexión del sitio');

      const estado = {
        ws,
        ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress,
        info: null,
        hashSnapshot: null,
      };
      estado.canal = new Canal(ws, handlersPara(loc, estado), {
        nombre: `sitio ${loc.id}`,
        alCerrar: () => {
          if (sitios.get(loc.id) === estado) {
            sitios.delete(loc.id);
            console.log(`🏠 [sitio ${loc.id} · ${loc.nombre}] desconectado`);
            marcarBalanzasDesconectadas(loc.id).catch(() => {});
          }
        },
      });
      sitios.set(loc.id, estado);

      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('error', (err) => console.error(`❌ [sitio ${loc.id}] error:`, err.message));
      console.log(`🏠 [sitio ${loc.id} · ${loc.nombre}] conectado desde ${estado.ip}`);
    } catch (err) {
      console.error('❌ Error en conexión de sitio:', err.message);
      ws.close(1011, 'Error interno');
    }
  });

  const ping = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === undefined) return;
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, PING_MS);

  // Red de seguridad por si algún cambio del central no pasó por avisarCambioCentral()
  const revision = setInterval(() => {
    for (const id of sitios.keys()) enviarSnapshot(id).catch(() => {});
  }, SNAPSHOT_REVISION_MS);

  wss.on('close', () => {
    clearInterval(ping);
    clearInterval(revision);
  });
  return wss;
};
