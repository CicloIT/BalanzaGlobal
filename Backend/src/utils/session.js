/**
 * Sesión firmada (HMAC-SHA256) en cookie httpOnly.
 * Token: base64url(JSON {uid, exp}) + '.' + base64url(firma)
 * El navegador la manda sola en fetch, <img>, enlaces a PDF y WebSocket del mismo origen.
 * Scripts pueden mandar el mismo token como "Authorization: Bearer <token>".
 */

import 'dotenv/config';
import crypto from 'crypto';

export const COOKIE_SESION = 'balanza_sesion';
const TTL_MS = (parseFloat(process.env.SESSION_TTL_HORAS) || 12) * 60 * 60 * 1000;

let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  SESSION_SECRET no definido en .env: las sesiones se pierden al reiniciar el backend');
}

const firmar = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export const crearToken = (userId) => {
  const data = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TTL_MS })).toString('base64url');
  return `${data}.${firmar(data)}`;
};

// → id de usuario o null
export const verificarToken = (token) => {
  if (typeof token !== 'string') return null;
  const [data, firma] = token.split('.');
  if (!data || !firma) return null;
  const a = Buffer.from(firma);
  const b = Buffer.from(firmar(data));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(data, 'base64url').toString());
    return Number.isInteger(uid) && exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
};

const leerCookie = (header, nombre) => {
  for (const parte of (header || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
};

// Token del request (cookie o Authorization: Bearer). Sirve para HTTP y para el upgrade del WebSocket.
export const tokenDeRequest = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return leerCookie(req.headers.cookie, COOKIE_SESION);
};

const esHttps = (req) => req.secure || req.headers['x-forwarded-proto'] === 'https';

export const setCookieSesion = (req, res, token) => {
  res.cookie(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: esHttps(req),
    maxAge: TTL_MS,
    path: '/',
  });
};

export const clearCookieSesion = (req, res) => {
  res.clearCookie(COOKIE_SESION, { httpOnly: true, sameSite: 'lax', secure: esHttps(req), path: '/' });
};
