// Pasa a hash (scrypt) todas las contraseñas guardadas en texto plano. Idempotente.
// Uso (en el servidor, con el .env del Backend): node scripts/hashear_passwords.mjs
// Los usuarios siguen entrando con la misma contraseña.
import pool from '../src/config/database.js';
import { hashPassword, isHashed } from '../src/utils/password.js';

const { rows } = await pool.query('SELECT id, username, password_hash FROM usuario');
let n = 0;
for (const u of rows) {
  if (!u.password_hash || isHashed(u.password_hash)) continue;
  await pool.query('UPDATE usuario SET password_hash = $1 WHERE id = $2', [await hashPassword(u.password_hash), u.id]);
  n++;
}
console.log(`🔐 ${n} contraseña(s) hasheadas; ${rows.length - n} ya estaban (o vacías).`);
await pool.end();
