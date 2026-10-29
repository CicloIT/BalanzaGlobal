// Smoke test del canal de agentes (/agent) + aislamiento de pesos + validación de pesadas.
// Uso: node scripts/smoke_agentes.mjs <baseUrl> <tokenElMirador> <tokenQuines>
//   Tokens: node scripts/agente_token.mjs <idBalanza>  (balanzas de balancero_elmirador y balancero_quines)
//   Simula los dos agentes por WS (no hace falta sim_balanzas ni Agente/ corriendo para estas balanzas).
// Requiere migration_agente.sql y los usuarios de seed_usuarios.sql.
import WebSocket from 'ws';

const [BASE = 'http://localhost:3000', TOKEN_A, TOKEN_B] = process.argv.slice(2);
const WS_BASE = BASE.replace(/^http/, 'ws');
let fallos = 0;

const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fallos++;
};
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

const login = async (username) => {
  const r = await fetch(`${BASE}/api/usuarios/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123456' }),
  });
  const d = await r.json();
  if (!d.success) throw new Error(`login ${username}: ${d.error}`);
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

// Agente falso: se conecta con el token, espera WELCOME y publica `peso` cada 300 ms
const agenteFalso = (token, peso) => new Promise((resolve) => {
  const ws = new WebSocket(`${WS_BASE}/agent`, { headers: { Authorization: `Bearer ${token}` } });
  const agente = { ws, peso, welcome: null, closeCode: null, timer: null };
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.type !== 'WELCOME') return;
    agente.welcome = msg;
    ws.send(JSON.stringify({ type: 'HELLO', version: 'smoke', hostname: 'smoke' }));
    ws.send(JSON.stringify({ type: 'STATUS', connected: true }));
    agente.timer = setInterval(() => ws.send(JSON.stringify({ type: 'WEIGHT', weight: agente.peso, stable: true })), 300);
    resolve(agente);
  });
  ws.on('close', (code) => { agente.closeCode = code; clearInterval(agente.timer); resolve(agente); });
  ws.on('error', () => {});
});

// Cliente navegador: junta mensajes durante `ms`
const clienteWs = (user, ms = 2500, alAbrir) => new Promise((resolve) => {
  const ws = new WebSocket(`${WS_BASE}/ws`, { headers: { Cookie: user.cookie } });
  const msgs = [];
  ws.on('open', () => alAbrir && setTimeout(alAbrir, 500));
  ws.on('message', (m) => msgs.push(JSON.parse(m)));
  setTimeout(() => { ws.close(); resolve(msgs); }, ms);
});

const main = async () => {
  if (!TOKEN_A || !TOKEN_B) {
    console.error('Uso: node scripts/smoke_agentes.mjs <baseUrl> <tokenElMirador> <tokenQuines>');
    process.exit(1);
  }
  const usuario1 = await login('balancero_elmirador');
  const usuario2 = await login('balancero_quines');
  const balancero1 = await login('balancero_elmirador');
  const bal1 = (await api(usuario1, 'GET', '/api/config/balanzas')).data.data[0];
  const bal2 = (await api(usuario2, 'GET', '/api/config/balanzas')).data.data[0];

  // ── Autenticación del agente ──
  const intruso = await agenteFalso('token-que-no-existe', 1);
  check(intruso.closeCode === 4401, 'agente con token inválido se rechaza (4401)');

  const agenteA = await agenteFalso(TOKEN_A, 1000);
  const agenteB = await agenteFalso(TOKEN_B, 5000);
  check(agenteA.welcome?.dispositivo_id === bal1.id, `token A → balanza de El Mirador (${bal1.id})`);
  check(agenteB.welcome?.dispositivo_id === bal2.id, `token B → balanza de Quines (${bal2.id})`);
  await esperar(800);

  // ── Aislamiento de pesos ──
  const [m1, m2] = await Promise.all([clienteWs(usuario1), clienteWs(usuario2)]);
  const pesos = (msgs) => [...new Set(msgs.filter(m => m.type === 'WEIGHT' || 'currentWeight' in m)
    .map(m => m.weight ?? m.currentWeight))];
  console.log('   pesos L1:', pesos(m1).join(','), '| pesos L2:', pesos(m2).join(','));
  check(m1[0]?.status === 'CONNECTED' && m1[0]?.currentWeight === 1000, 'cliente L1 ve su balanza conectada con 1000 kg');
  check(m2[0]?.status === 'CONNECTED' && m2[0]?.currentWeight === 5000, 'cliente L2 ve su balanza conectada con 5000 kg');
  check(pesos(m1).every(p => p === 1000) && m1.every(m => m.dispositivo_id === bal1.id), 'cliente L1 nunca recibe el peso de L2');
  check(pesos(m2).every(p => p === 5000) && m2.every(m => m.dispositivo_id === bal2.id), 'cliente L2 nunca recibe el peso de L1');

  const estados = (await api(usuario1, 'GET', '/api/config/balanzas')).data.data[0];
  check(estados.agente_online === true && estados.modo_conexion === 'agente', '/api/config/balanzas informa agente online');

  // ── Pesadas validadas contra la balanza ──
  const patente = `AG${Date.now() % 100000}`;
  const veh = await api(usuario1, 'POST', '/api/vehiculos', { patente, tipo_vehiculo: 'CHASIS' });
  check(veh.status === 201, `vehículo ${patente} creado en El Mirador`);
  // pesada exige chofer/productor/transporte/producto de la misma localidad
  const catalogo = async (path, body) => (await api(usuario1, 'POST', path, body)).data.data?.id;
  const refs = {
    chofer_id: await catalogo('/api/choferes', { apellido_nombre: `Chofer ${patente}` }),
    productor_id: await catalogo('/api/productores', { nombre: `Productor ${patente}` }),
    transporte_id: await catalogo('/api/transportes', { nombre: `Transporte ${patente}` }),
    producto_id: await catalogo('/api/productos', { nombre: `Producto ${patente}` }),
  };
  check(Object.values(refs).every(Boolean), 'catálogos de prueba creados en El Mirador');
  const pesada = (peso, extra = {}) => api(balancero1, 'POST', '/api/pesadas', {
    vehiculo_patente: patente, sentido: 'INGRESO', peso, dispositivo_id: bal1.id, ...refs, ...extra,
  });

  const inventado = await pesada(1234);
  check(inventado.status === 409, `peso que la balanza no marcó → 409 (${inventado.data.error || inventado.status})`);
  const deOtroSitio = await pesada(5000);
  check(deOtroSitio.status === 409, 'peso de la balanza de Quines no sirve para El Mirador → 409');
  const ajena = await pesada(5000, { dispositivo_id: bal2.id });
  check(ajena.status === 403, 'balancero de El Mirador no puede usar la balanza de Quines → 403');

  const bruto = await pesada(1000);
  check(bruto.status === 201 && bruto.data.data?.tipo === 'BRUTO', `1ª pesada 1000 kg → BRUTO (${bruto.status}${bruto.data.error ? ` ${bruto.data.error}` : ""})`);
  agenteA.peso = 400;   // el camión vuelve vacío
  await esperar(1000);
  const tara = await pesada(400);
  check(tara.status === 201 && tara.data.data?.tipo === 'TARA', `2ª pesada 400 kg → TARA (${tara.status}${tara.data.error ? ` ${tara.data.error}` : ""})`);
  check(tara.data.data?.operacion_id === bruto.data.data?.operacion_id, 'BRUTO y TARA en la misma operación');
  const lista = await api(usuario1, 'GET', '/api/pesadas');
  const op = (lista.data.data || []).filter(p => p.operacion_id === bruto.data.data?.operacion_id);
  const neto = op.find(p => p.neto != null)?.neto;
  console.log(`   operación ${bruto.data.data?.operacion_id}: ${op.map(p => `${p.tipo}=${p.peso}`).join(' ')}${neto != null ? ` neto=${neto}` : ''}`);
  if (neto != null) check(Number(neto) === 600, 'neto = 1000 - 400 = 600');

  // ── Un solo agente por balanza ──
  const agenteA2 = await agenteFalso(TOKEN_A, 400);
  await esperar(300);
  check(agenteA.closeCode === 4409, 'segundo agente con el mismo token reemplaza al primero (4409)');

  // ── Caída del agente ──
  const m1b = await clienteWs(usuario1, 2000, () => agenteA2.ws.close());
  const caida = m1b.find(m => m.type === 'STATUS' && m.status === 'DISCONNECTED');
  check(caida?.error === 'Agente desconectado', 'cliente L1 ve "Agente desconectado" al caer el agente');
  check(m1b.every(m => m.dispositivo_id === bal1.id), 'el aviso de caída solo llega a L1');

  agenteB.ws.close();
  console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
  setTimeout(() => process.exit(fallos ? 1 : 0), 200);
};

main().catch((e) => { console.error(e); process.exit(1); });
