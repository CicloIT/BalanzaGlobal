/**
 * Ejecuta en ESTE servidor un request reenviado por el otro lado (central ↔ sitio),
 * como si lo hubiera hecho el usuario `user_id`: pasa por las mismas rutas, permisos,
 * alcance y validaciones que un request normal.
 */
import { crearToken } from '../../utils/session.js';

const PORT = process.env.PORT || 3000;

/**
 * @param {{ method, path, user_id, content_type?, body?, body_b64? }} rpc
 * @returns {{ status, body }}
 */
export const ejecutarLocal = async ({ method, path, user_id, content_type, body, body_b64 }) => {
  if (!/^\/api\//.test(path || '')) throw new Error('Ruta no permitida');
  if (!Number.isInteger(user_id)) throw new Error('Usuario inválido');

  const headers = { Authorization: `Bearer ${crearToken(user_id)}`, 'x-sitio-rpc': '1' };
  let payload;
  if (body_b64) {
    payload = Buffer.from(body_b64, 'base64');
    if (content_type) headers['Content-Type'] = content_type;
  } else if (body !== undefined && body !== null) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method, headers, body: payload });
  const texto = await r.text();
  let json;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { success: false, error: texto }; }
  return { status: r.status, body: json };
};
