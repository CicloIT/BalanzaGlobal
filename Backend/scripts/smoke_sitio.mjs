// Prueba de punta a punta del modo sitio (v2 local-first). Levanta central y sitio como
// procesos hijos, corta el central para simular la caída de internet y verifica la réplica.
//
// Requisitos (en la PC de desarrollo):
//   - base del central con migration_v2_sitio.sql aplicada (DB del .env, ej. balanzaglobal)
//   - base del sitio vacía: schema.sql + migration_v2_sitio.sql (ej. balanza_sitio_2)
//   - simulador de la balanza del sitio: node scripts/sim_balanzas.mjs 4102:5000
//   - token del sitio: node scripts/sitio_token.mjs 2
// Uso:
//   node scripts/smoke_sitio.mjs <SITIO_TOKEN> [localidadId=2] [dbSitio=balanza_sitio_2]
// Usuarios de prueba con contraseña 123456: superadmin, balancero_quines (de la localidad).
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(__dirname, '..');
const [TOKEN, locArg, dbSitioArg] = process.argv.slice(2);
const L = parseInt(locArg || '2', 10);
const DB_SITIO = dbSitioArg || 'balanza_sitio_2';
const CENTRAL = 'http://127.0.0.1:3000';
const SITIO = 'http://127.0.0.1:3100';
if (!TOKEN) {
  console.error('Uso: node scripts/smoke_sitio.mjs <SITIO_TOKEN> [localidadId] [dbSitio]');
  process.exit(1);
}

const dbCfg = (database) => ({
  user: process.env.DB_USER || 'postgres', password: String(process.env.DB_PASSWORD || '123'),
  host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT, 10) || 5432, database,
});
const dbCentral = new pg.Pool(dbCfg(process.env.DB_NAME || 'balanzaglobal'));
const dbSitio = new pg.Pool(dbCfg(DB_SITIO));

let ok = 0, fallos = 0;
const check = (cond, msg) => {
  if (cond) { ok++; console.log(`  ✅ ${msg}`); } else { fallos++; console.log(`  ❌ ${msg}`); }
};
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const hasta = async (fn, ms = 15000) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try { if (await fn()) return true; } catch { /* reintentar */ }
    await esperar(300);
  }
  return false;
};

// ─── Procesos ─────────────────────────────────────────────────────────────────
const procesos = {};
const levantar = (nombre, env) => {
  const p = spawn(process.execPath, ['src/server.js'], { cwd: BACKEND, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.log = '';
  p.stdout.on('data', d => { p.log += d; });
  p.stderr.on('data', d => { p.log += d; });
  procesos[nombre] = p;
  return p;
};
const bajar = async (nombre) => {
  const p = procesos[nombre];
  if (!p || p.exitCode !== null) return;
  p.kill();
  await new Promise(r => p.once('exit', r));
};
const levantarCentral = () => levantar('central', { MODO: 'central', LOCALIDAD_ID: '', PORT: '3000' });
const levantarSitio = () => levantar('sitio', {
  MODO: 'sitio', LOCALIDAD_ID: String(L), PORT: '3100', DB_NAME: DB_SITIO,
  CENTRAL_URL: 'ws://127.0.0.1:3000/sitio', SITIO_TOKEN: TOKEN, SESSION_SECRET: 'smoke-sitio-secreto',
});
const vivo = (base) => hasta(async () => (await fetch(`${base}/api/health`)).ok, 20000);

// ─── HTTP ─────────────────────────────────────────────────────────────────────
const login = async (base, username, password = '123456') => {
  const r = await fetch(`${base}/api/usuarios/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  });
  if (!r.ok) return null;
  const cookie = r.headers.get('set-cookie')?.split(';')[0];
  return { base, cookie, ...(await r.json()).user };
};
const api = async (s, method, ruta, body) => {
  const r = await fetch(`${s.base}${ruta}`, {
    method, headers: { Cookie: s.cookie, ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, data };
};
const outbox = async () => (await dbSitio.query('SELECT COUNT(*)::int n FROM sync_outbox')).rows[0].n;
const sincronizado = () => hasta(async () => (await outbox()) === 0);
const fila = async (db, sql, params) => (await db.query(sql, params)).rows[0];

// ─── Prueba ───────────────────────────────────────────────────────────────────
const main = async () => {
  const sufijo = Date.now().toString(36).toUpperCase().slice(-5);
  console.log('▶ Levantando central y sitio...');
  levantarCentral();
  check(await vivo(CENTRAL), 'central responde');
  levantarSitio();
  check(await vivo(SITIO), 'sitio responde');
  check(await hasta(async () => (await fila(dbSitio, `SELECT valor FROM sync_estado WHERE clave = 'modo'`))?.valor?.localidad_id === L, 30000),
    'sitio inicializado (bootstrap)');
  check((await fila(dbCentral, 'SELECT sitio_activo FROM localidad WHERE id = $1', [L])).sitio_activo, 'central marca la localidad con servidor propio');

  const cuenta = async (db, t) => (await fila(db, `SELECT COUNT(*)::int n FROM ${t} WHERE localidad_id = $1`, [L])).n;
  for (const t of ['chofer', 'vehiculo', 'producto', 'productor', 'transporte', 'operacion_pesaje', 'reporte']) {
    check(await cuenta(dbSitio, t) === await cuenta(dbCentral, t), `bootstrap: ${t} igual en sitio y central`);
  }

  console.log('▶ Login y alcance en el sitio');
  const bal = await login(SITIO, 'balancero_quines');
  check(bal?.localidad_id === L, 'balancero entra en el sitio (usuario bajado del central)');
  const superSitio = await login(SITIO, 'superadmin');
  check((await api(superSitio, 'POST', '/api/usuarios', { username: 'x', password: 'yyyyyyyy', rol: 'balancero' })).status === 403,
    'en el sitio no se administran usuarios (403 SOLO_CENTRAL)');

  console.log('▶ Peso en vivo del sitio en el central');
  const balanzaId = (await fila(dbSitio,
    `SELECT id FROM configuracion_dispositivos WHERE tipo_dispositivo = 'balanza' AND localidad_id = $1 ORDER BY id LIMIT 1`, [L])).id;
  check(await hasta(async () => {
    const h = await (await fetch(`${CENTRAL}/api/health`)).json();
    const b = h.scale.find(x => x.dispositivo_id === balanzaId);
    return b?.modo === 'sitio' && b.connected && b.lastWeight !== null;
  }), `central ve conectada y con peso la balanza ${balanzaId} del sitio`);

  console.log('▶ Pesada completa en el sitio (con central arriba)');
  const ref = async (t) => (await fila(dbSitio, `SELECT id FROM ${t} WHERE localidad_id = $1 AND activo ORDER BY id LIMIT 1`, [L])).id;
  const base = {
    dispositivo_id: balanzaId, chofer_id: await ref('chofer'), productor_id: await ref('productor'),
    transporte_id: await ref('transporte'), producto_id: await ref('producto'), es_manual: true, balancero: 'smoke',
  };
  const vehiculo = async (patente) => {
    const r = await api(bal, 'POST', '/api/vehiculos', { patente, tipo_vehiculo: 'CHASIS' });
    if (r.status !== 201) throw new Error(`alta de vehículo ${patente}: ${r.status} ${r.data?.error}`);
  };
  const pat1 = `SM${sufijo}A`;
  await vehiculo(pat1);
  const p1 = await api(bal, 'POST', '/api/pesadas', { ...base, vehiculo_patente: pat1, sentido: 'INGRESO', peso: 30000 });
  const p2 = await api(bal, 'POST', '/api/pesadas', { ...base, vehiculo_patente: pat1, sentido: 'INGRESO', peso: 12000 });
  check(p1.status === 201 && p2.status === 201, `bruto y tara cargados en el sitio → ${p1.status} ${p1.data?.error || ''} / ${p2.status} ${p2.data?.error || ''}`);
  const op1 = p1.data?.data?.operacion_id;
  check(op1 >= L * 10000000 && op1 < (L + 1) * 10000000, `id de operación en el rango del sitio (${op1})`);
  check(await sincronizado(), 'outbox vacío');
  const opC = await fila(dbCentral, 'SELECT abierta FROM operacion_pesaje WHERE id = $1', [op1]);
  const netos = (await dbCentral.query('SELECT neto FROM pesada WHERE operacion_id = $1', [op1])).rows.map(r => Number(r.neto));
  check(opC && opC.abierta === false && netos.length === 2 && netos.every(n => n === 18000), 'central tiene la operación cerrada con neto 18000');

  console.log('▶ Reporte numerado por localidad');
  const rep = await api(bal, 'POST', '/api/reportes', { pesadas: [{ bruto: 30000, tara: 12000, neto: 18000, localidad_id: L }] });
  check(rep.status === 201, 'reporte creado en el sitio');
  await sincronizado();
  const repC = await fila(dbCentral, 'SELECT numero_reporte, localidad_id FROM reporte WHERE id = $1', [rep.data?.data?.id]);
  check(repC?.numero_reporte === rep.data?.data?.numero_reporte && repC.localidad_id === L, `reporte replicado con su número (${repC?.numero_reporte})`);

  console.log('▶ Superadmin en el central escribe datos del sitio (reenvío)');
  const sa = await login(CENTRAL, 'superadmin');
  const nuevo = await api(sa, 'POST', '/api/choferes', { apellido_nombre: `CHOFER CENTRAL ${sufijo}`, localidad_id: L });
  check(nuevo.status === 201, `alta de chofer desde el central → ${nuevo.status}`);
  const chId = nuevo.data?.data?.id;
  check(chId >= L * 10000000, 'el chofer se creó en el sitio (id del rango del sitio)');
  check(Boolean(await fila(dbCentral, 'SELECT 1 AS x FROM chofer WHERE id = $1', [chId])), 'y ya está replicado en el central al responder');
  const edit = await api(sa, 'PUT', `/api/choferes/${chId}`, { apellido_nombre: `CHOFER EDITADO ${sufijo}` });
  check(edit.status === 200, 'edición reenviada');
  check((await fila(dbSitio, 'SELECT apellido_nombre FROM chofer WHERE id = $1', [chId]))?.apellido_nombre === `CHOFER EDITADO ${sufijo}`, 'edición aplicada en el sitio');
  const pesarCentral = await api(sa, 'POST', '/api/pesadas', { ...base, vehiculo_patente: `SM${sufijo}X`, sentido: 'INGRESO', peso: 1000 });
  check(pesarCentral.status === 409, 'el central no carga pesadas de una localidad con servidor propio');

  console.log('▶ Invertir operación con neto negativo desde el central');
  const pat2 = `SM${sufijo}B`;
  await vehiculo(pat2);
  const n1 = await api(bal, 'POST', '/api/pesadas', { ...base, vehiculo_patente: pat2, sentido: 'INGRESO', peso: 9000 });
  await api(bal, 'POST', '/api/pesadas', { ...base, vehiculo_patente: pat2, sentido: 'INGRESO', peso: 25000 });
  const op2 = n1.data?.data?.operacion_id;
  await sincronizado();
  const inv = await api(sa, 'POST', `/api/pesadas/operacion/${op2}/invertir`);
  check(inv.status === 200, `invertir reenviado → ${inv.status} ${inv.data?.error || ''}`);
  await sincronizado();
  const opInv = await fila(dbCentral, 'SELECT sentido FROM operacion_pesaje WHERE id = $1', [op2]);
  const netoInv = await fila(dbCentral, 'SELECT neto FROM pesada WHERE operacion_id = $1 LIMIT 1', [op2]);
  check(opInv?.sentido === 'SALIDA' && Number(netoInv?.neto) === 16000, 'central: sentido SALIDA y neto 16000');

  console.log('▶ Pedido de borrado (sitio) y aprobación (central)');
  const sol = await api(bal, 'POST', '/api/pesadas/operaciones/solicitar-borrado', { ids: [op2], motivo: 'smoke sitio' });
  check(sol.status === 201 || sol.status === 200, `pedido de borrado en el sitio → ${sol.status}`);
  await sincronizado();
  const solId = (await fila(dbCentral, 'SELECT borrado_solicitud_id FROM operacion_pesaje WHERE id = $1', [op2]))?.borrado_solicitud_id;
  check(Boolean(solId), 'el central ve la solicitud');
  const apr = await api(sa, 'POST', `/api/solicitudes-borrado/${solId}/aprobar`, {});
  check(apr.status === 200, `aprobación reenviada → ${apr.status} ${apr.data?.error || ''}`);
  await sincronizado();
  check(!(await fila(dbCentral, 'SELECT 1 AS x FROM operacion_pesaje WHERE id = $1', [op2])), 'operación borrada en el central');
  check(!(await fila(dbSitio, 'SELECT 1 AS x FROM operacion_pesaje WHERE id = $1', [op2])), 'operación borrada en el sitio');

  console.log('▶ Usuario nuevo en el central baja al sitio');
  const uname = `smoke_${sufijo.toLowerCase()}`;
  const u = await api(sa, 'POST', '/api/usuarios', { username: uname, password: 'clave1234', rol: 'balancero', localidad_id: L, empresa_id: bal.empresa_id });
  check(u.status === 201, `usuario creado en el central → ${u.status} ${u.data?.error || ''}`);
  check(await hasta(async () => Boolean(await login(SITIO, uname, 'clave1234'))), 'el usuario nuevo entra en el sitio');

  console.log('▶ Sin internet: se corta el central');
  await bajar('central');
  const pat3 = `SM${sufijo}C`;
  await vehiculo(pat3);   // sin central: también se da de alta
  const off1 = await api(bal, 'POST', '/api/pesadas', { ...base, vehiculo_patente: pat3, sentido: 'INGRESO', peso: 20000 });
  const off2 = await api(bal, 'POST', '/api/pesadas', { ...base, vehiculo_patente: pat3, sentido: 'INGRESO', peso: 5000 });
  const offCh = await api(bal, 'POST', '/api/choferes', { apellido_nombre: `CHOFER OFFLINE ${sufijo}` });
  check(off1.status === 201 && off2.status === 201 && offCh.status === 201, `sin central: se pesa y se dan de alta catálogos → ${off1.status} ${off1.data?.error || ''} / ${offCh.status} ${offCh.data?.error || ''}`);
  check(Boolean(await login(SITIO, 'balancero_quines')), 'sin central: el login sigue andando');
  check(await outbox() > 0, `quedan cambios pendientes (${await outbox()})`);
  const pwd = await api(bal, 'PUT', '/api/usuarios/me/password', { actual: '123456', nueva: '123456' });
  check(pwd.status === 503, 'sin central: cambio de contraseña responde 503');
  const est = await api(bal, 'GET', '/api/sitio/estado');
  check(est.data?.data?.conectado === false && est.data?.data?.pendientes > 0, 'estado del sitio: desconectado con pendientes');

  console.log('▶ Vuelve internet');
  levantarCentral();
  check(await vivo(CENTRAL), 'central de nuevo arriba');
  check(await hasta(async () => (await outbox()) === 0, 30000), 'el sitio vació el outbox');
  const op3 = off1.data?.data?.operacion_id;
  const op3C = await fila(dbCentral, 'SELECT abierta FROM operacion_pesaje WHERE id = $1', [op3]);
  check(op3C?.abierta === false, 'la operación hecha sin internet está en el central, cerrada');
  check(Boolean(await fila(dbCentral, 'SELECT 1 AS x FROM chofer WHERE id = $1', [offCh.data?.data?.id])), 'el chofer dado de alta sin internet está en el central');

  console.log('▶ Sitio caído: el central no puede escribir sus datos');
  await bajar('sitio');
  const sa2 = await login(CENTRAL, 'superadmin');
  const caido = await api(sa2, 'PUT', `/api/choferes/${chId}`, { apellido_nombre: 'NO DEBE' });
  check(caido.status === 503 && caido.data?.code === 'SITIO_OFFLINE', 'edición desde el central con el sitio caído → 503');
  const lectura = await api(sa2, 'GET', `/api/choferes?localidad_id=${L}`);
  check(lectura.status === 200, 'el central sigue leyendo la réplica');

  console.log('▶ Reenvío del mismo lote no duplica');
  const antes = (await fila(dbCentral, 'SELECT COUNT(*)::int n FROM pesada')).n;
  // Se reinyecta en el outbox del sitio el INSERT de una pesada ya subida
  await dbSitio.query(`INSERT INTO sync_outbox (tabla, op, pk, fila)
    SELECT 'pesada', 'I', jsonb_build_object('id', id), to_jsonb(p) FROM pesada p WHERE operacion_id = $1`, [op1]);
  levantarSitio();
  check(await vivo(SITIO), 'sitio de nuevo arriba');
  check(await hasta(async () => (await outbox()) === 0, 30000), 'outbox reenviado');
  check((await fila(dbCentral, 'SELECT COUNT(*)::int n FROM pesada')).n === antes, 'sin duplicados en el central');
};

main()
  .catch(err => { fallos++; console.error('💥', err); })
  .finally(async () => {
    await bajar('sitio');
    await bajar('central');
    if (fallos) {
      console.log('\n--- log central ---\n' + (procesos.central?.log || '').slice(-3000));
      console.log('\n--- log sitio ---\n' + (procesos.sitio?.log || '').slice(-3000));
    }
    console.log(`\n${ok} OK · ${fallos} fallos`);
    await dbCentral.end();
    await dbSitio.end();
    process.exit(fallos ? 1 : 0);
  });
