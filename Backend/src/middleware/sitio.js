/**
 * Middlewares del modelo central/sitio (v2 local-first). Se montan en server.js ANTES de las rutas.
 *
 * Central:
 *   reenviarASitio  → escrituras sobre datos de una localidad con servidor propio se ejecutan
 *                     en ese servidor (RPC por /sitio); sin conexión → 503 SITIO_OFFLINE.
 *   avisarSitios    → tras escribir usuarios/localidades/empresas/dispositivos, manda el
 *                     snapshot nuevo a los sitios conectados.
 * Sitio:
 *   guardiaSitio    → usuarios/localidades/empresas/provincias/dispositivos se administran solo
 *                     en el central (403 SOLO_CENTRAL); el cambio de contraseña propia se reenvía
 *                     al central; mientras el sitio no terminó de inicializarse no se escribe.
 */
import pool from '../config/database.js';
import { esSitio } from '../config/modo.js';
import { userFromRequest } from './authMiddleware.js';
import { pedirRpcSitio, avisarCambioCentral } from '../services/sitioGateway.js';
import { rpcCentral, sitioListo } from '../services/sitioSync.js';

const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

// Rutas cuyos datos son del sitio (lo que se reenvía desde el central)
const PREFIJOS_SITIO = /^\/api\/(choferes|vehiculos|productos|productores|transportes|pesadas|reportes|solicitudes-borrado)(\/|$)/;
// Rutas cuyos datos son del central
const PREFIJOS_CENTRAL = /^\/api\/(usuarios|localidades|empresas|provincias|config)(\/|$)/;
const LIBRES_EN_SITIO = /^\/api\/usuarios\/(login|logout)$/;
const PASSWORD_PROPIA = /^\/api\/usuarios\/me\/password$/;

const CATALOGOS = { choferes: 'chofer', vehiculos: 'vehiculo', productos: 'producto', productores: 'productor', transportes: 'transporte' };

const unaColumna = async (sql, params) => (await pool.query(sql, params)).rows.map(r => r.localidad_id);
const enteros = (lista) => (Array.isArray(lista) ? lista : []).map(n => parseInt(n, 10)).filter(Number.isInteger);

/** Localidades que toca una escritura de un usuario global (sin localidad fija). */
const localidadesObjetivo = async (req) => {
  const p = req.path;
  const body = req.is('application/json') ? (req.body || {}) : {};
  let m;
  if ((m = p.match(/^\/api\/(choferes|vehiculos|productos|productores|transportes)(?:\/(\d+))?\/?$/))) {
    if (m[2]) return unaColumna(`SELECT localidad_id FROM ${CATALOGOS[m[1]]} WHERE id = $1`, [m[2]]);
    return enteros([body.localidad_id ?? req.query.localidad_id]);
  }
  if ((m = p.match(/^\/api\/pesadas\/operacion\/(\d+)(\/|$)/))) {
    return unaColumna('SELECT localidad_id FROM operacion_pesaje WHERE id = $1', [m[1]]);
  }
  if (/^\/api\/pesadas\/operaciones\/(delete-masivo|solicitar-borrado)$/.test(p)) {
    return unaColumna('SELECT DISTINCT localidad_id FROM operacion_pesaje WHERE id = ANY($1::int[])', [enteros(body.ids)]);
  }
  if ((m = p.match(/^\/api\/pesadas\/(\d+)$/))) {
    return unaColumna(
      'SELECT o.localidad_id FROM pesada p JOIN operacion_pesaje o ON o.id = p.operacion_id WHERE p.id = $1', [m[1]]);
  }
  if (/^\/api\/reportes\/?$/.test(p)) {
    if (body.localidad_id) return enteros([body.localidad_id]);
    return [...new Set(enteros((body.pesadas || []).map(x => x?.localidad_id)))];
  }
  if (/^\/api\/reportes\/delete-masivo$/.test(p)) {
    return unaColumna('SELECT DISTINCT localidad_id FROM reporte WHERE id = ANY($1::int[])', [enteros(body.ids)]);
  }
  if ((m = p.match(/^\/api\/reportes\/(\d+)$/))) {
    return unaColumna('SELECT localidad_id FROM reporte WHERE id = $1', [m[1]]);
  }
  if ((m = p.match(/^\/api\/solicitudes-borrado\/(\d+)\//))) {
    return unaColumna('SELECT localidad_id FROM solicitud_borrado WHERE id = $1', [m[1]]);
  }
  return [];   // POST /api/pesadas de un global: lo frena createPesada (multipart, sin body acá)
};

const leerCuerpoCrudo = async (req) => {
  const partes = [];
  for await (const parte of req) partes.push(parte);
  return Buffer.concat(partes);
};

/** Arma el request para ejecutarlo en el otro servidor (ver services/sync/rpcLocal.js). */
const armarRpc = async (req, user) => {
  const rpc = { method: req.method, path: req.originalUrl, user_id: user.id };
  if (req.is('application/json')) rpc.body = req.body;
  else if (req.headers['content-type']) {
    rpc.content_type = req.headers['content-type'];
    rpc.body_b64 = (await leerCuerpoCrudo(req)).toString('base64');
  }
  return rpc;
};

const responderRpc = (res, r) => res.status(r.status).json(r.body);

const responderOffline = (res, err, code) => res.status(503).json({ success: false, error: err.message, message: err.message, code });

// ─── Central ──────────────────────────────────────────────────────────────────
export const reenviarASitio = async (req, res, next) => {
  if (LECTURA.has(req.method) || !PREFIJOS_SITIO.test(req.path) || req.headers['x-sitio-rpc']) return next();
  try {
    const user = await userFromRequest(req);
    if (!user) return next();   // la ruta responde 401
    const objetivo = user.localidad_id ? [user.localidad_id] : await localidadesObjetivo(req);
    if (!objetivo.length) return next();

    const r = await pool.query(
      'SELECT id, nombre FROM localidad WHERE id = ANY($1::int[]) AND sitio_activo', [objetivo]);
    if (!r.rows.length) return next();
    if (objetivo.length > 1) {
      return res.status(400).json({
        success: false,
        error: `${r.rows.map(x => x.nombre).join(', ')} tiene servidor propio: seleccione registros de una sola localidad`,
      });
    }
    const resultado = await pedirRpcSitio(r.rows[0].id, await armarRpc(req, user));
    responderRpc(res, resultado);
  } catch (err) {
    if (err.code === 'SITIO_OFFLINE') return responderOffline(res, err, 'SITIO_OFFLINE');
    console.error('❌ Reenvío al sitio:', err.message);
    res.status(502).json({ success: false, error: `El servidor de la localidad no pudo procesarlo: ${err.message}` });
  }
};

export const avisarSitios = (req, res, next) => {
  if (!LECTURA.has(req.method) && PREFIJOS_CENTRAL.test(req.path) && !LIBRES_EN_SITIO.test(req.path)) {
    res.on('finish', () => { if (res.statusCode < 400) avisarCambioCentral(); });
  }
  next();
};

// ─── Sitio ────────────────────────────────────────────────────────────────────
export const guardiaSitio = async (req, res, next) => {
  if (LECTURA.has(req.method) || LIBRES_EN_SITIO.test(req.path)) return next();

  if (PASSWORD_PROPIA.test(req.path)) {
    try {
      const user = await userFromRequest(req);
      if (!user) return next();
      return responderRpc(res, await rpcCentral(await armarRpc(req, user)));
    } catch (err) {
      if (err.code === 'CENTRAL_OFFLINE') return responderOffline(res, err, 'CENTRAL_OFFLINE');
      return res.status(502).json({ success: false, error: err.message });
    }
  }
  if (PREFIJOS_CENTRAL.test(req.path)) {
    return res.status(403).json({
      success: false,
      error: 'Esto se administra desde el servidor central',
      code: 'SOLO_CENTRAL',
    });
  }
  if (PREFIJOS_SITIO.test(req.path) && !sitioListo()) {
    return res.status(503).json({
      success: false,
      error: 'El servidor de la localidad todavía se está inicializando con el central; reintente en unos minutos',
      code: 'SITIO_INICIALIZANDO',
    });
  }
  next();
};

export const middlewaresDeModo = () => (esSitio() ? [guardiaSitio] : [reenviarASitio, avisarSitios]);
