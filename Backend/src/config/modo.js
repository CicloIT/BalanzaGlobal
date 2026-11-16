/**
 * Modo de la instalación (v2 local-first).
 *
 *  MODO=central (por defecto) → servidor central: todas las localidades. Las que tienen
 *                               servidor propio (localidad.sitio_activo) se reciben por /sitio.
 *  MODO=sitio                 → servidor de UNA localidad (LOCALIDAD_ID), en su LAN. Pesa sin
 *                               internet y replica al central por CENTRAL_URL (wss://…/sitio)
 *                               con SITIO_TOKEN.
 */
import 'dotenv/config';

const modo = (process.env.MODO || 'central').trim().toLowerCase();
if (!['central', 'sitio'].includes(modo)) {
  throw new Error(`MODO inválido en .env: "${process.env.MODO}" (usar central o sitio)`);
}

const localidadEnv = process.env.LOCALIDAD_ID ? parseInt(process.env.LOCALIDAD_ID, 10) : null;

if (modo === 'sitio') {
  const faltan = [];
  if (!localidadEnv) faltan.push('LOCALIDAD_ID');
  if (!process.env.CENTRAL_URL) faltan.push('CENTRAL_URL');
  if (!process.env.SITIO_TOKEN) faltan.push('SITIO_TOKEN');
  if (faltan.length) throw new Error(`MODO=sitio requiere en .env: ${faltan.join(', ')}`);
}

export const esSitio = () => modo === 'sitio';
export const esCentral = () => modo === 'central';

/** Localidad de este servidor en modo sitio (o la de LOCALIDAD_ID en central, si se usa). */
export const localidadSitio = () => localidadEnv;

export const centralUrl = () => process.env.CENTRAL_URL;
export const sitioToken = () => process.env.SITIO_TOKEN;

/** Versión del protocolo/esquema de sincronización: central y sitio deben coincidir. */
export const SYNC_SCHEMA = 1;

/** Tablas cuyo dueño es el sitio, en orden de dependencias (igual que sync_tablas_sitio()). */
export const TABLAS_SITIO = [
  'chofer', 'vehiculo', 'producto', 'productor', 'transporte',
  'solicitud_borrado', 'operacion_pesaje', 'pesada',
  'solicitud_borrado_operacion', 'reporte',
];

/** Tablas cuyo dueño es el central (bajan al sitio), en orden de dependencias. */
export const TABLAS_CENTRAL = [
  'provincia', 'empresa', 'empresa_config', 'localidad', 'usuario', 'configuracion_dispositivos',
];
