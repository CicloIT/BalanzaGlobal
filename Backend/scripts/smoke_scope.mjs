// Smoke test de roles, alcance por localidad y WebSocket por balanza.
// Uso: node scripts/smoke_scope.mjs [baseUrl]   (default http://localhost:3000)
// Requiere migration_empresa_scope.sql, migration_roles_simplificados.sql y los usuarios de
// seed_usuarios.sql (superadmin, logistica, balancero_elmirador, balancero_quines; clave 123456).
// Lo que crea (vehículos y un chofer de prueba) lo da de baja al final (DELETE de la API es baja lógica).
import WebSocket from 'ws';

const BASE = process.argv[2] || 'http://localhost:3000';
let fallos = 0;

const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fallos++;
};

const login = async (username, password = '123456') => {
  const r = await fetch(`${BASE}/api/usuarios/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const d = await r.json();
  if (!d.success) return null;
  // La sesión viene en la cookie httpOnly: se guarda para mandarla en cada request
  const cookie = r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  return { ...d.user, cookie };
};

const api = async (user, method, path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

// Abre el WS, junta mensajes durante `ms` y cierra
const wsMensajes = (user, dispositivoId, ms = 2500) => new Promise((resolve) => {
  const wsBase = BASE.replace(/^http/, 'ws');
  const qs = dispositivoId ? `?dispositivoId=${dispositivoId}` : '';
  const ws = new WebSocket(`${wsBase}/ws${qs}`, { headers: user?.cookie ? { Cookie: user.cookie } : {} });
  const msgs = [];
  ws.on('message', (m) => msgs.push(JSON.parse(m)));
  ws.on('close', (code) => msgs.push({ type: 'CLOSE', code }));
  setTimeout(() => { ws.close(); resolve(msgs); }, ms);
});

const main = async () => {
  const bal1 = await login('balancero_elmirador');
  const bal2 = await login('balancero_quines');
  const logistica = await login('logistica');
  const superadmin = await login('superadmin');
  if (!bal1 || !bal2 || !logistica || !superadmin) throw new Error('Faltan usuarios del seed (ver encabezado)');
  check(!superadmin.empresa_id && !superadmin.localidad_id, 'superadmin es de plataforma (sin empresa ni localidad)');
  check(logistica.empresa_id && !logistica.localidad_id, 'logística es global de su empresa');

  // ── Roles eliminados: no entran ──
  for (const u of ['admin', 'admin_elmirador', 'gerente_elmirador', 'subalancero_elmirador']) {
    check(!(await login(u)), `${u} (rol eliminado) no puede iniciar sesión`);
  }

  // ── Catálogos por localidad (el balancero crea, no edita ni borra) ──
  const patente = `TST${Date.now() % 100000}`;
  const v1 = await api(bal1, 'POST', '/api/vehiculos', { patente, tipo_vehiculo: 'CHASIS' });
  const v2 = await api(bal2, 'POST', '/api/vehiculos', { patente, tipo_vehiculo: 'CHASIS' });
  check(v1.status === 201 && v2.status === 201, 'misma patente creada en 2 localidades');
  check(v1.data.data?.localidad_id === bal1.localidad_id, 'vehículo estampado con la localidad del balancero');

  const lista1 = await api(bal1, 'GET', `/api/vehiculos?search=${patente}`);
  check(lista1.data.data?.length === 1 && lista1.data.data[0].id === v1.data.data.id, 'balancero L1 solo ve su vehículo');
  check((await api(bal1, 'PUT', `/api/vehiculos/${v1.data.data.id}`, { observaciones: 'x' })).status === 403, 'balancero no edita catálogos');
  check((await api(bal1, 'DELETE', `/api/vehiculos/${v1.data.data.id}`)).status === 403, 'balancero no borra catálogos');

  const globalSinLoc = await api(superadmin, 'POST', '/api/choferes', { apellido_nombre: `Chofer ${patente}` });
  check(globalSinLoc.status === 400, 'superadmin debe indicar localidad_id al crear catálogo');
  const globalConLoc = await api(superadmin, 'POST', '/api/choferes', { apellido_nombre: `Chofer ${patente}`, localidad_id: 2 });
  check(globalConLoc.status === 201 && globalConLoc.data.data.localidad_id === 2, 'superadmin crea chofer en la localidad elegida');

  const listaSuper = await api(superadmin, 'GET', `/api/vehiculos?search=${patente}`);
  check(listaSuper.data.data?.length === 2, 'superadmin ve ambas localidades');
  const listaSuperL2 = await api(superadmin, 'GET', `/api/vehiculos?search=${patente}&localidad_id=2`);
  check(listaSuperL2.data.data?.length === 1, 'superadmin puede acotar con ?localidad_id=');

  // ── Logística: solo dashboard ──
  check((await api(logistica, 'GET', '/api/metricas/dashboard')).status === 200, 'logística ve el dashboard (todas las localidades)');
  check((await api(logistica, 'GET', '/api/metricas/dashboard?localidad_id=2')).status === 200, 'logística filtra el dashboard por localidad');
  for (const path of ['/api/pesadas/agrupadas', '/api/vehiculos', '/api/reportes', '/api/config/balanzas', '/api/usuarios', '/api/backup/list']) {
    check((await api(logistica, 'GET', path)).status === 403, `logística no accede a ${path}`);
  }

  // ── Usuarios: solo superadmin ──
  check((await api(bal1, 'GET', '/api/usuarios')).status === 403, 'balancero no gestiona usuarios');
  const usuariosSuper = await api(superadmin, 'GET', '/api/usuarios');
  check(usuariosSuper.data.data?.some(u => u.rol === 'superadmin'), 'superadmin ve usuarios de plataforma');
  const rolViejo = await api(superadmin, 'POST', '/api/usuarios', { username: `g_${patente}`, password: 'clave123', rol: 'gerente', localidad_id: 1 });
  check(rolViejo.status === 400, 'no se pueden crear usuarios con roles eliminados');

  // ── Balanzas / WebSocket ──
  const balanzas1 = await api(bal1, 'GET', '/api/config/balanzas');
  const balanzas2 = await api(bal2, 'GET', '/api/config/balanzas');
  const balanzasSuper = await api(superadmin, 'GET', '/api/config/balanzas');
  check(balanzas1.data.data?.length === 1 && balanzas2.data.data?.length === 1, 'cada localidad ve una sola balanza');
  check(balanzasSuper.data.data?.length >= 2, 'superadmin ve todas las balanzas');

  const [m1, m2, mSuper2, mIntruso] = await Promise.all([
    wsMensajes(bal1),
    wsMensajes(bal2),
    wsMensajes(superadmin, balanzas2.data.data[0].id),
    wsMensajes(bal1, balanzas2.data.data[0].id),   // pide balanza ajena → recibe la suya
  ]);
  const disp = (msgs) => new Set(msgs.filter(m => m.dispositivo_id).map(m => m.dispositivo_id));
  const pesos = (msgs) => msgs.filter(m => m.type === 'WEIGHT').map(m => m.weight);
  console.log('   pesos L1:', pesos(m1).join(','), '| pesos L2:', pesos(m2).join(','));
  check([...disp(m1)].every(d => d === balanzas1.data.data[0].id), 'WS L1 solo recibe su balanza');
  check([...disp(m2)].every(d => d === balanzas2.data.data[0].id), 'WS L2 solo recibe su balanza');
  check([...disp(mSuper2)].every(d => d === balanzas2.data.data[0].id), 'superadmin suscripto a balanza L2');
  check([...disp(mIntruso)].every(d => d === balanzas1.data.data[0].id), 'usuario local no puede suscribirse a balanza ajena');
  const anon = await wsMensajes({ id: 999999 });
  check(anon.some(m => m.type === 'CLOSE' && m.code === 4401), 'WS sin usuario válido se rechaza (4401)');

  // ── Pesada ──
  const pesada = await api(bal1, 'POST', '/api/pesadas', {
    vehiculo_patente: patente, sentido: 'INGRESO', peso: 1000, dispositivo_id: balanzas2.data.data[0].id,
  });
  check(pesada.status === 403, 'balancero L1 no puede pesar con balanza de L2');
  const pesadaOk = await api(bal1, 'POST', '/api/pesadas', {
    vehiculo_patente: patente, sentido: 'INGRESO', peso: 1000, dispositivo_id: balanzas1.data.data[0].id,
    chofer_id: globalConLoc.data.data.id,
  });
  check(pesadaOk.status === 400, 'pesada rechaza chofer de otra localidad');
  check((await api(bal1, 'PUT', '/api/pesadas/1', { peso: 1 })).status === 403, 'balancero no corrige el peso de una pesada registrada');

  // ── Sesión y contraseñas ──
  const falso = await fetch(`${BASE}/api/choferes`, { headers: { 'x-user-id': String(superadmin.id) } });
  check(falso.status === 401, 'header x-user-id ya no autentica (401)');
  const cookieTrucha = await fetch(`${BASE}/api/choferes`, { headers: { Cookie: 'balanza_sesion=eyJ1aWQiOjF9.firma' } });
  check(cookieTrucha.status === 401, 'cookie de sesión con firma inválida → 401');
  check(!(await login('superadmin', 'incorrecta')), 'login con contraseña incorrecta se rechaza');
  const me = await api(superadmin, 'GET', '/api/usuarios/me');
  check(me.status === 200 && me.data.user?.id === superadmin.id && !('password_hash' in me.data.user), '/me devuelve la sesión sin password');
  check((await fetch(`${BASE}/documentos/no-existe.pdf`)).status === 401, '/documentos sin sesión → 401');
  check((await fetch(`${BASE}/capturas/x.jpg`)).status === 401, '/capturas sin sesión → 401');

  // ── Respaldos: solo superadmin ──
  check((await api(bal1, 'GET', '/api/backup/list')).status === 403, 'balancero no accede a respaldos');
  check((await api(superadmin, 'GET', '/api/backup/list')).status === 200, 'superadmin lista respaldos');

  // ── Reportes: el balancero ve y reimprime los de su localidad, no borra ──
  const pesadaRep = { bruto: 1000, tara: 400, neto: 600, vehiculo_patente: patente };
  const rep1 = await api(bal1, 'POST', '/api/reportes', { pesadas: [pesadaRep], observaciones: `smoke ${patente}` });
  const rep2 = await api(bal2, 'POST', '/api/reportes', { pesadas: [pesadaRep], observaciones: `smoke ${patente}` });
  check(rep1.status === 201 && rep2.status === 201, 'balancero genera reporte');
  const reps1 = await api(bal1, 'GET', '/api/reportes');
  check(reps1.status === 200 && reps1.data.data?.some(r => r.id === rep1.data.data?.id), 'balancero lista sus reportes');
  check(!reps1.data.data?.some(r => r.id === rep2.data.data?.id), 'balancero no ve reportes de otra localidad');
  check((await api(bal1, 'GET', `/api/reportes/${rep1.data.data?.id}`)).status === 200, 'balancero abre su reporte para reimprimir');
  check((await api(bal1, 'GET', `/api/reportes/${rep2.data.data?.id}`)).status === 404, 'balancero no abre reporte de otra localidad');
  check((await api(bal1, 'POST', '/api/reportes/delete-masivo', { ids: [rep1.data.data?.id] })).status === 403, 'balancero no borra reportes');
  const repIds = [rep1.data.data?.id, rep2.data.data?.id].filter(Boolean);
  if (repIds.length) await api(superadmin, 'POST', '/api/reportes/delete-masivo', { ids: repIds });

  // ── Pedido de borrado: el balancero pide, las operaciones se le ocultan, el superadmin decide ──
  {
    const cat = async (path, body) => (await api(bal1, 'POST', path, body)).data.data?.id;
    const refs = {
      chofer_id: await cat('/api/choferes', { apellido_nombre: `Chofer borrado ${patente}` }),
      productor_id: await cat('/api/productores', { nombre: `Productor ${patente}` }),
      transporte_id: await cat('/api/transportes', { nombre: `Transporte ${patente}` }),
      producto_id: await cat('/api/productos', { codigo: `BR${patente}`, nombre: `Prod borrado ${patente}` }),
    };
    const pesar = (peso, sentido) => api(bal1, 'POST', '/api/pesadas', {
      vehiculo_patente: patente, sentido, peso, es_manual: true, dispositivo_id: balanzas1.data.data[0].id, ...refs,
    });
    const p1 = await pesar(1000, 'INGRESO');
    check(p1.status === 201, 'balancero registra bruto (manual) para probar el borrado');
    const opId = p1.data.data?.operacion_id;
    const solicitar = (user, body) => api(user, 'POST', '/api/pesadas/operaciones/solicitar-borrado', body);
    check((await solicitar(bal1, { ids: [opId], motivo: 'prueba' })).status === 409, 'no se pide borrar una operación en proceso');
    const p2 = await pesar(400, 'INGRESO');
    check(p2.status === 201 && p2.data.data?.operacion_id === opId, 'tara cierra la operación');

    const ve = async (user) => (await api(user, 'GET', '/api/pesadas/agrupadas?limit=100')).data.data?.find(o => o.id === opId);
    check((await api(bal1, 'POST', '/api/pesadas/operaciones/delete-masivo', { ids: [opId] })).status === 403, 'balancero sigue sin poder borrar directo');
    check((await solicitar(bal1, { ids: [opId], motivo: '   ' })).status === 400, 'pedido de borrado sin motivo → 400');
    check((await solicitar(bal2, { ids: [opId], motivo: 'ajena' })).status === 404, 'balancero no pide borrar operaciones de otra localidad');
    check((await solicitar(logistica, { ids: [opId], motivo: 'x' })).status === 403, 'logística no pide borrados');

    const s1 = await solicitar(bal1, { ids: [opId], motivo: 'Pesada duplicada' });
    check(s1.status === 201 && s1.data.solicitudes?.length === 1, 'balancero pide el borrado con motivo');
    const sol1 = s1.data.solicitudes?.[0];
    check(!(await ve(bal1)), 'la operación se le oculta al balancero');
    check((await api(bal1, 'PUT', `/api/pesadas/operacion/${opId}/contenedor`, { nro_contenedor: 'X' })).status === 404, 'balancero no modifica una operación oculta');
    check((await solicitar(bal1, { ids: [opId], motivo: 'otra vez' })).status === 409, 'no se repite el pedido sobre una operación ya pedida');
    const opSuper = await ve(superadmin);
    check(opSuper?.borrado_pendiente === true, 'superadmin la sigue viendo, marcada como borrado pendiente');
    check((await solicitar(superadmin, { ids: [opId], motivo: 'x' })).status === 409, 'no se duplica un pedido pendiente');
    check((await api(bal1, 'GET', '/api/solicitudes-borrado')).status === 403, 'balancero no ve la bandeja de pedidos');
    check((await api(bal1, 'POST', `/api/solicitudes-borrado/${sol1}/aprobar`)).status === 403, 'balancero no aprueba pedidos');
    check((await api(superadmin, 'GET', '/api/solicitudes-borrado/pendientes/count')).data.count >= 1, 'superadmin ve el contador de pendientes');
    const bandeja = await api(superadmin, 'GET', '/api/solicitudes-borrado');
    const enBandeja = bandeja.data.data?.find(s => s.id === sol1);
    check(enBandeja?.motivo === 'Pesada duplicada' && Number(enBandeja?.operaciones?.[0]?.bruto) === 1000, 'la bandeja trae motivo y datos de la operación');

    const rech = await api(superadmin, 'POST', `/api/solicitudes-borrado/${sol1}/rechazar`, { comentario: 'No es duplicada' });
    check(rech.status === 200, 'superadmin rechaza el pedido');
    check(Boolean(await ve(bal1)), 'al rechazar, la operación vuelve a verse para el balancero');
    check((await api(superadmin, 'POST', `/api/solicitudes-borrado/${sol1}/aprobar`)).status === 409, 'un pedido ya resuelto no se puede aprobar');

    const s2 = await solicitar(bal1, { ids: [opId], motivo: 'Ahora sí, duplicada' });
    const sol2 = s2.data.solicitudes?.[0];
    check(s2.status === 201, 'se puede volver a pedir después de un rechazo');
    check((await api(superadmin, 'POST', `/api/solicitudes-borrado/${sol2}/aprobar`)).status === 200, 'superadmin aprueba el pedido');
    check(!(await ve(superadmin)), 'al aprobar, la operación se borra');
    const aprobadas = await api(superadmin, 'GET', '/api/solicitudes-borrado?estado=aprobada');
    const reg = aprobadas.data.data?.find(s => s.id === sol2);
    check(reg?.resuelto_por === superadmin.id && reg?.operaciones?.[0]?.vehiculo_patente === patente, 'queda registro de lo borrado (quién pidió, quién aprobó, datos)');

    for (const [path, id] of [['/api/choferes', refs.chofer_id], ['/api/productores', refs.productor_id], ['/api/transportes', refs.transporte_id], ['/api/productos', refs.producto_id]]) {
      if (id) await api(superadmin, 'DELETE', `${path}/${id}`);
    }
  }

  // ── Catálogos: duplicados con mensaje claro y baja que no bloquea volver a cargar ──
  const codigo = `ZZ${patente}`;
  const prod1 = await api(bal1, 'POST', '/api/productos', { codigo, nombre: `Producto ${patente}` });
  check(prod1.status === 201, 'balancero crea producto');
  const prodDup = await api(bal1, 'POST', '/api/productos', { codigo, nombre: `Otro ${patente}` });
  check(prodDup.status === 409 && prodDup.data.error === `Ya existe un producto con el código "${codigo}" en esta localidad`,
    'código duplicado → 409 con mensaje legible');
  check((await api(superadmin, 'DELETE', `/api/productos/${prod1.data.data?.id}`)).status === 200, 'baja de producto sin uso');
  const prod2 = await api(bal1, 'POST', '/api/productos', { codigo, nombre: `Producto ${patente}` });
  check(prod2.status === 201, 'se puede volver a cargar el mismo código después de la baja');
  if (prod2.data.data?.id) await api(superadmin, 'DELETE', `/api/productos/${prod2.data.data.id}`);

  // ── Limpieza ──
  for (const id of [v1.data.data?.id, v2.data.data?.id].filter(Boolean)) {
    await api(superadmin, 'DELETE', `/api/vehiculos/${id}`);
  }
  if (globalConLoc.data.data?.id) await api(superadmin, 'DELETE', `/api/choferes/${globalConLoc.data.data.id}`);

  console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
  process.exit(fallos ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
