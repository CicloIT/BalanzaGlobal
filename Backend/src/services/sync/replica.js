/**
 * Aplicar filas replicadas (genérico por tabla) y resolver archivos referenciados.
 * Lo usan el central (cambios que suben del sitio) y el sitio (snapshot del central, bootstrap).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Claves primarias ─────────────────────────────────────────────────────────
const PK = {
  solicitud_borrado_operacion: ['solicitud_id', 'operacion_id'],
  empresa_config: ['empresa_id'],
};
export const pkDe = (tabla) => PK[tabla] ?? ['id'];

const q = (ident) => `"${String(ident).replace(/"/g, '""')}"`;

// Columnas por tabla (cache: el esquema no cambia con el servidor andando)
const columnas = new Map();
const columnasDe = async (client, tabla) => {
  if (!columnas.has(tabla)) {
    const r = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [tabla]
    );
    if (!r.rows.length) throw new Error(`Tabla desconocida: ${tabla}`);
    columnas.set(tabla, r.rows.map(x => x.column_name));
  }
  return columnas.get(tabla);
};

/** INSERT … ON CONFLICT (pk) DO UPDATE con todas las columnas de `fila` (jsonb de la fila completa). */
export const upsertFila = async (client, tabla, fila) => {
  const cols = await columnasDe(client, tabla);
  const pk = pkDe(tabla);
  const set = cols.filter(c => !pk.includes(c)).map(c => `${q(c)} = EXCLUDED.${q(c)}`);
  await client.query(
    `INSERT INTO ${q(tabla)}
     SELECT * FROM jsonb_populate_record(NULL::${q(tabla)}, $1::jsonb)
     ON CONFLICT (${pk.map(q).join(', ')}) DO ${set.length ? `UPDATE SET ${set.join(', ')}` : 'NOTHING'}`,
    [JSON.stringify(fila)]
  );
};

export const borrarFila = async (client, tabla, pkValores) => {
  const pk = pkDe(tabla);
  await client.query(
    `DELETE FROM ${q(tabla)} WHERE ${pk.map((c, i) => `${q(c)} = $${i + 1}`).join(' AND ')}`,
    pk.map(c => pkValores[c])
  );
};

// ─── Localidad dueña de una fila (validar que el sitio solo toque lo suyo) ────
export const localidadDeFila = async (client, tabla, fila) => {
  if (fila.localidad_id !== undefined) return fila.localidad_id;
  if (tabla === 'pesada') {
    const r = await client.query('SELECT localidad_id FROM operacion_pesaje WHERE id = $1', [fila.operacion_id]);
    return r.rows[0]?.localidad_id ?? null;
  }
  if (tabla === 'solicitud_borrado_operacion') {
    const r = await client.query('SELECT localidad_id FROM solicitud_borrado WHERE id = $1', [fila.solicitud_id]);
    return r.rows[0]?.localidad_id ?? null;
  }
  return null;
};

/** Localidad de la fila que ya existe con esa pk (null si no existe). */
export const localidadExistente = async (client, tabla, pkValores) => {
  const pk = pkDe(tabla);
  const r = await client.query(
    `SELECT to_jsonb(t) AS fila FROM ${q(tabla)} t WHERE ${pk.map((c, i) => `${q(c)} = $${i + 1}`).join(' AND ')}`,
    pk.map(c => pkValores[c])
  );
  if (!r.rows.length) return undefined;
  return localidadDeFila(client, tabla, r.rows[0].fila);
};

// ─── Archivos (capturas y PDF) ────────────────────────────────────────────────
// Clave = 'capturas/<ruta relativa>' o 'documentos/<archivo>'; igual en sitio y central.
const BASES = {
  capturas: path.resolve(__dirname, '../../../capturas'),
  documentos: path.resolve(__dirname, '../../documentos'),
};

/** Ruta absoluta de una clave, o null si la clave es inválida o sale de su carpeta. */
export const rutaArchivo = (clave) => {
  if (typeof clave !== 'string') return null;
  const i = clave.indexOf('/');
  if (i < 1) return null;
  const base = BASES[clave.slice(0, i)];
  const rel = clave.slice(i + 1);
  if (!base || !rel || rel.includes('\0')) return null;
  const abs = path.resolve(base, rel);
  return abs.startsWith(base + path.sep) ? abs : null;
};

/** Claves de archivos que referencia una fila de pesada. */
export const archivosDeFila = (tabla, fila) => {
  if (tabla !== 'pesada' || !fila) return [];
  const claves = [];
  if (typeof fila.ruta === 'string' && fila.ruta) {
    claves.push(fila.ruta.startsWith('documentos/') ? fila.ruta : `documentos/${fila.ruta}`);
  }
  let fotos = fila.fotos;
  if (typeof fotos === 'string') {
    try { fotos = JSON.parse(fotos); } catch { fotos = null; }
  }
  if (Array.isArray(fotos)) {
    for (const f of fotos) {
      const ruta = typeof f === 'string' ? f : f?.ruta;
      if (typeof ruta === 'string' && ruta) claves.push(`capturas/${ruta}`);
    }
  }
  return claves.filter(c => rutaArchivo(c));
};

export const existeArchivo = (clave) => {
  const abs = rutaArchivo(clave);
  return Boolean(abs && fs.existsSync(abs));
};

export const leerArchivoB64 = (clave) => {
  const abs = rutaArchivo(clave);
  if (!abs || !fs.existsSync(abs)) return null;
  return fs.readFileSync(abs).toString('base64');
};

export const guardarArchivoB64 = (clave, b64) => {
  const abs = rutaArchivo(clave);
  if (!abs) throw new Error(`Clave de archivo inválida: ${clave}`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.from(b64, 'base64'));
};

/** Archivos referenciados por las pesadas de una localidad que faltan en este servidor. */
export const archivosFaltantesDeLocalidad = async (db, localidadId) => {
  const r = await db.query(
    `SELECT p.ruta, p.fotos FROM pesada p
     JOIN operacion_pesaje o ON o.id = p.operacion_id
     WHERE o.localidad_id = $1 AND (p.ruta IS NOT NULL OR p.fotos IS NOT NULL)`,
    [localidadId]
  );
  const faltan = new Set();
  for (const fila of r.rows) {
    for (const clave of archivosDeFila('pesada', fila)) if (!existeArchivo(clave)) faltan.add(clave);
  }
  return [...faltan];
};

/** ¿Alguna pesada de la localidad referencia esta clave? */
export const archivoEsDeLocalidad = async (db, localidadId, clave) => {
  const r = await db.query(
    `SELECT p.ruta, p.fotos FROM pesada p
     JOIN operacion_pesaje o ON o.id = p.operacion_id
     WHERE o.localidad_id = $1
       AND (p.ruta = $2 OR p.ruta = $3 OR p.fotos::text LIKE '%' || $4 || '%')`,
    [localidadId, clave, clave.replace(/^documentos\//, ''), clave.replace(/^capturas\//, '')]
  );
  return r.rows.some(fila => archivosDeFila('pesada', fila).includes(clave));
};
