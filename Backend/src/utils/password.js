/**
 * Contraseñas con scrypt (crypto nativo de Node, sin dependencias).
 * Formato guardado en usuario.password_hash: scrypt$<salt hex>$<hash hex>
 * Valores sin ese prefijo son contraseñas viejas en texto plano: se aceptan una vez
 * y el login las re-guarda hasheadas (needsRehash).
 */

import crypto from 'crypto';

const PREFIJO = 'scrypt$';
const KEYLEN = 64;

const scrypt = (password, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key)))
  );

export const isHashed = (stored) => typeof stored === 'string' && stored.startsWith(PREFIJO);

export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt);
  return `${PREFIJO}${salt}$${key.toString('hex')}`;
};

// → { ok, needsRehash }
export const verifyPassword = async (password, stored) => {
  if (!stored || typeof password !== 'string') return { ok: false, needsRehash: false };

  if (!isHashed(stored)) {
    const a = Buffer.from(password);
    const b = Buffer.from(stored);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { ok, needsRehash: ok };
  }

  const [, salt, hashHex] = stored.split('$');
  const esperado = Buffer.from(hashHex, 'hex');
  const key = await scrypt(password, salt);
  const ok = key.length === esperado.length && crypto.timingSafeEqual(key, esperado);
  return { ok, needsRehash: false };
};
