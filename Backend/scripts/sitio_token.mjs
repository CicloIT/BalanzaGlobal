// Token del servidor de sitio de una localidad (v2 local-first). Correrlo en el CENTRAL.
// Uso:  node scripts/sitio_token.mjs <localidadId>               → genera token (se muestra solo esta vez)
//       node scripts/sitio_token.mjs <localidadId> --revocar     → revoca el token (el sitio deja de sincronizar)
//       node scripts/sitio_token.mjs <localidadId> --desactivar  → revoca y la localidad vuelve a trabajar contra
//                                                                 el central (reiniciar el backend central)
//       node scripts/sitio_token.mjs --listar
// El token va en el .env del sitio: SITIO_TOKEN=...
// Si el backend central está corriendo y el sitio estaba conectado, regenerar el token lo corta al
// reiniciar (o usar el botón de la vista Localidades, que lo corta en el momento).
import pool from '../src/config/database.js';
import { generarTokenSitio, hashTokenSitio } from '../src/services/sitioGateway.js';

const [arg, flag] = process.argv.slice(2);

const main = async () => {
  if (arg === '--listar') {
    const { rows } = await pool.query(`
      SELECT id, nombre, sitio_activo, sitio_token_hash IS NOT NULL AS con_token, sitio_ultima_sync,
             sitio_info->>'version' AS version, sitio_info->>'hostname' AS hostname
      FROM localidad ORDER BY id`);
    console.table(rows);
    return;
  }
  const id = parseInt(arg, 10);
  if (!id) {
    console.error('Uso: node scripts/sitio_token.mjs <localidadId> [--revocar|--desactivar] | --listar');
    process.exitCode = 1;
    return;
  }
  if (flag === '--revocar' || flag === '--desactivar') {
    const r = await pool.query(
      `UPDATE localidad SET sitio_token_hash = NULL,
              sitio_activo = CASE WHEN $2 THEN false ELSE sitio_activo END
       WHERE id = $1 RETURNING nombre, sitio_activo`,
      [id, flag === '--desactivar']);
    console.log(r.rowCount
      ? `Localidad ${id} (${r.rows[0].nombre}): token revocado${flag === '--desactivar' ? '; vuelve a trabajar contra el central' : ''}.`
      : `No existe la localidad ${id}.`);
    return;
  }
  const token = generarTokenSitio();
  const r = await pool.query(
    'UPDATE localidad SET sitio_token_hash = $2 WHERE id = $1 RETURNING nombre', [id, hashTokenSitio(token)]);
  if (!r.rowCount) {
    console.error(`No existe la localidad ${id}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Localidad ${id} (${r.rows[0].nombre}). Poner en el .env del sitio:\n`);
  console.log(`MODO=sitio\nLOCALIDAD_ID=${id}\nSITIO_TOKEN=${token}\nCENTRAL_URL=wss://<central>/sitio\n`);
  console.log('El token no se vuelve a mostrar.');
};

main()
  .catch(err => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
