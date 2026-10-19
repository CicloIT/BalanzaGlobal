// Smoke test de alcance empresa/localidad + WebSocket por balanza.
// Uso: node scripts/smoke_scope.mjs [baseUrl]   (default http://localhost:3000)
// Requiere la migración migration_empresa_scope.sql y los usuarios de seed_usuarios.sql.
import WebSocket from 'ws';

const BASE = process.argv[2] || 'http://localhost:3000';
let fallos = 0;

const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fallos++;
};

const login = async (username) => {
  const r = await fetch(`${BASE}/api/usuarios/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123456' }),
  });
  const d = await r.json();
  if (!d.success) throw new Error(`login ${username}: ${d.error}`);
  return d.user;
};

const api = async (user, method, path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-user-id': String(user.id) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

// Abre el WS, junta mensajes durante `ms` y cierra
const wsMensajes = (user, dispositivoId, ms = 2500) => new Promise((resolve) => {
  const wsBase = BASE.replace(/^http/, 'ws');
  const qs = `userId=${user.id}${dispositivoId ? `&dispositivoId=${dispositivoId}` : ''}`;
  const ws = new WebSocket(`${wsBase}/ws?${qs}`);
  const msgs = [];
  ws.on('message', (m) => msgs.push(JSON.parse(m)));
  ws.on('close', (code) => msgs.push({ type: 'CLOSE', code }));
  setTimeout(() => { ws.close(); resolve(msgs); }, ms);
});

const main = async () => {
  const gerente1 = await login('gerente_elmirador');
  const gerente2 = await login('gerente_quines');
  const admin1 = await login('admin_elmirador');
  const admin = await login('admin');
  const superadmin = await login('superadmin');
  check(admin.empresa_id === 1 && !admin.localidad_id, 'admin global pertenece a empresa 1');

  // ── Catálogos por localidad ──
  const patente = `TST${Date.now() % 100000}`;
  const v1 = await api(gerente1, 'POST', '/api/vehiculos', { patente, tipo_vehiculo: 'CHASIS' });
  const v2 = await api(gerente2, 'POST', '/api/vehiculos', { patente, tipo_vehiculo: 'CHASIS' });
  check(v1.status === 201 && v2.status === 201, 'misma patente creada en 2 localidades');
  check(v1.data.data?.localidad_id === gerente1.localidad_id, 'vehículo estampado con la localidad del gerente');

  const lista1 = await api(gerente1, 'GET', `/api/vehiculos?search=${patente}`);
  check(lista1.data.data?.length === 1 && lista1.data.data[0].id === v1.data.data.id, 'gerente L1 solo ve su vehículo');

  const ajenoPut = await api(gerente1, 'PUT', `/api/vehiculos/${v2.data.data.id}`, { observaciones: 'hack' });
  check(ajenoPut.status === 404, 'gerente L1 no puede editar vehículo de L2 (404)');

  const globalSinLoc = await api(admin, 'POST', '/api/choferes', { apellido_nombre: `Chofer ${patente}` });
  check(globalSinLoc.status === 400, 'admin global debe indicar localidad_id al crear catálogo');
  const globalConLoc = await api(admin, 'POST', '/api/choferes', { apellido_nombre: `Chofer ${patente}`, localidad_id: 2 });
  check(globalConLoc.status === 201 && globalConLoc.data.data.localidad_id === 2, 'admin global crea chofer en localidad elegida');

  const listaAdmin = await api(admin, 'GET', `/api/vehiculos?search=${patente}`);
  check(listaAdmin.data.data?.length === 2, 'admin global ve ambas localidades');
  const listaAdminL2 = await api(admin, 'GET', `/api/vehiculos?search=${patente}&localidad_id=2`);
  check(listaAdminL2.data.data?.length === 1, 'admin global puede acotar con ?localidad_id=');

  // ── Usuarios ──
  const usuariosAdmin1 = await api(admin1, 'GET', '/api/usuarios');
  check(usuariosAdmin1.data.data.every(u => u.localidad_id === admin1.localidad_id), 'admin local solo ve usuarios de su localidad');
  const nuevo = await api(admin1, 'POST', '/api/usuarios', { username: `u_${patente}`, password_hash: 'x', rol: 'balancero', localidad_id: 2 });
  check(nuevo.status === 201 && nuevo.data.data.localidad_id === admin1.localidad_id, 'admin local: localidad ajena forzada a la suya');
  const escalar = await api(admin1, 'POST', '/api/usuarios', { username: `l_${patente}`, password_hash: 'x', rol: 'logistica' });
  check(escalar.status === 403, 'admin local no puede crear rol global');
  const usuariosSuper = await api(superadmin, 'GET', '/api/usuarios');
  check(usuariosSuper.data.data.some(u => u.rol === 'superadmin'), 'superadmin ve usuarios de plataforma');
  const empresasAdmin = await api(admin, 'GET', '/api/empresas');
  check(empresasAdmin.status === 403, 'admin de empresa no gestiona empresas');

  // ── Balanzas / WebSocket ──
  const bal1 = await api(gerente1, 'GET', '/api/config/balanzas');
  const bal2 = await api(gerente2, 'GET', '/api/config/balanzas');
  const balAdmin = await api(admin, 'GET', '/api/config/balanzas');
  check(bal1.data.data?.length === 1 && bal2.data.data?.length === 1, 'cada localidad ve una sola balanza');
  check(balAdmin.data.data?.length >= 2, 'admin global ve todas las balanzas de la empresa');

  const [m1, m2, mAdmin2, mIntruso] = await Promise.all([
    wsMensajes(gerente1),
    wsMensajes(gerente2),
    wsMensajes(admin, bal2.data.data[0].id),
    wsMensajes(gerente1, bal2.data.data[0].id),   // pide balanza ajena → recibe la suya
  ]);
  const disp = (msgs) => new Set(msgs.filter(m => m.dispositivo_id).map(m => m.dispositivo_id));
  const pesos = (msgs) => msgs.filter(m => m.type === 'WEIGHT').map(m => m.weight);
  console.log('   pesos L1:', pesos(m1).join(','), '| pesos L2:', pesos(m2).join(','));
  check([...disp(m1)].every(d => d === bal1.data.data[0].id), 'WS L1 solo recibe su balanza');
  check([...disp(m2)].every(d => d === bal2.data.data[0].id), 'WS L2 solo recibe su balanza');
  check([...disp(mAdmin2)].every(d => d === bal2.data.data[0].id), 'admin global suscripto a balanza L2');
  check([...disp(mIntruso)].every(d => d === bal1.data.data[0].id), 'usuario local no puede suscribirse a balanza ajena');
  const anon = await wsMensajes({ id: 999999 });
  check(anon.some(m => m.type === 'CLOSE' && m.code === 4401), 'WS sin usuario válido se rechaza (4401)');

  // ── Pesada ──
  const p = await api(gerente1, 'GET', `/api/vehiculos?search=${patente}`);
  const balancero1 = await login('balancero_elmirador');
  const pesada = await api(balancero1, 'POST', '/api/pesadas', {
    vehiculo_patente: patente, sentido: 'INGRESO', peso: 1000, dispositivo_id: bal2.data.data[0].id,
  });
  check(pesada.status === 403, 'balancero L1 no puede pesar con balanza de L2');
  const pesadaOk = await api(balancero1, 'POST', '/api/pesadas', {
    vehiculo_patente: patente, sentido: 'INGRESO', peso: 1000, dispositivo_id: bal1.data.data[0].id,
    chofer_id: globalConLoc.data.data.id,
  });
  check(pesadaOk.status === 400, 'pesada rechaza chofer de otra localidad');
  void p;

  console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
  process.exit(fallos ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
