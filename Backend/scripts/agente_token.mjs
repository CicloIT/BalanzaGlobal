// Genera el token del agente local para una balanza y la pasa a modo agente.
// Uso:  node scripts/agente_token.mjs <dispositivoId>            → imprime el token (solo esta vez)
//       node scripts/agente_token.mjs <dispositivoId> --directo  → vuelve a modo directo y revoca el token
//       node scripts/agente_token.mjs --listar                   → balanzas con su modo y última conexión
// Usa la DB del .env del Backend (correrlo en el servidor central).
// Si el backend está corriendo, el cambio se aplica cuando el agente se conecta;
// para volver a modo directo reiniciar el backend o guardar la config de la balanza.
import pool from '../src/config/database.js';
import { hashToken, generarTokenAgente } from '../src/services/agenteGateway.js';

const [arg, flag] = process.argv.slice(2);

const listar = async () => {
  const { rows } = await pool.query(`
    SELECT cd.id, l.nombre AS localidad, cd.ip, cd.puerto, cd.modo_conexion,
           cd.agente_token_hash IS NOT NULL AS con_token, cd.agente_ultima_conexion
    FROM configuracion_dispositivos cd
    LEFT JOIN localidad l ON l.id = cd.localidad_id
    WHERE cd.tipo_dispositivo = 'balanza'
    ORDER BY cd.id
  `);
  console.table(rows);
};

const main = async () => {
  if (arg === '--listar') return listar();

  const id = parseInt(arg, 10);
  if (!id) {
    console.error('Uso: node scripts/agente_token.mjs <dispositivoId> [--directo] | --listar');
    process.exitCode = 1;
    return;
  }

  if (flag === '--directo') {
    const r = await pool.query(`
      UPDATE configuracion_dispositivos
      SET modo_conexion = 'directo', agente_token_hash = NULL
      WHERE id = $1 AND tipo_dispositivo = 'balanza' RETURNING id
    `, [id]);
    console.log(r.rowCount ? `Balanza ${id} en modo directo; token revocado.` : `No existe la balanza ${id}.`);
    return;
  }

  const token = generarTokenAgente();
  const r = await pool.query(`
    UPDATE configuracion_dispositivos
    SET modo_conexion = 'agente', agente_token_hash = $2
    WHERE id = $1 AND tipo_dispositivo = 'balanza'
    RETURNING id, localidad_id
  `, [id, hashToken(token)]);
  if (!r.rowCount) {
    console.error(`No existe la balanza ${id}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Balanza ${id} (localidad ${r.rows[0].localidad_id}) en modo agente.`);
  console.log('Token del agente (guardarlo ahora, no se puede volver a ver):\n');
  console.log(token);
};

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => pool.end());
