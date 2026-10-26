// Cambia la contraseña de un usuario desde la consola del servidor.
// Uso: node scripts/usuario_password.mjs <username> <nuevaContraseña>
import pool from '../src/config/database.js';
import { hashPassword } from '../src/utils/password.js';

const [username, nueva] = process.argv.slice(2);
if (!username || !nueva || nueva.length < 6) {
  console.error('Uso: node scripts/usuario_password.mjs <username> <nuevaContraseña (mín. 6)>');
  process.exit(1);
}
const r = await pool.query(
  'UPDATE usuario SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(username) = LOWER($2) RETURNING id, username',
  [await hashPassword(nueva), username]
);
console.log(r.rowCount ? `✅ Contraseña de ${r.rows[0].username} actualizada` : `❌ No existe el usuario ${username}`);
await pool.end();
process.exit(r.rowCount ? 0 : 1);
