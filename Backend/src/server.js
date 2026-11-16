import express from 'express';
import cors from 'cors';
import fs from "fs";
import path from "path";
import pool from './config/database.js';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from "url";
import { inicializarBalanzas, getEstadoBalanza, getEstadosBalanzas } from './services/balanzaService.js';
import { crearAgenteGateway } from './services/agenteGateway.js';
import { crearSitioGateway, estadoSitios } from './services/sitioGateway.js';
import { iniciarSitioSync, reenviarBalanza, estadoSync } from './services/sitioSync.js';
import { middlewaresDeModo } from './middleware/sitio.js';
import { esSitio } from './config/modo.js';
import { userFromRequest, requireAuth } from './middleware/authMiddleware.js';
import { scopeSql } from './utils/scope.js';

// Importar rutas
import choferesRoutes from './routes/choferes.js';
import productoresRoutes from './routes/productores.js';
import productosRoutes from './routes/productos.js';
import transportesRoutes from './routes/transportes.js';
import vehiculosRoutes from './routes/vehiculos.js';
import pesadasRoutes from './routes/pesadas.js';
import usuariosRoutes from './routes/usuarios.js';
import provinciasRoutes from './routes/provincias.js';
import localidadesRoutes from './routes/localidades.js';
import metricasRoutes from './routes/metricas.js';
import camarasRoutes from './routes/camaras.js';
import reportesRoutes from './routes/reporte.js';
import backupRoutes from './routes/backups.js';
import configRoutes from './routes/configuraciones.js';
import empresasRoutes from './routes/empresas.js';
import solicitudesBorradoRoutes from './routes/solicitudesBorrado.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Crear servidor HTTP y WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });      // navegadores: /ws?dispositivoId= (usuario por cookie de sesión)
const agenteWss = crearAgenteGateway();                    // agentes locales: /agent (token por balanza)
const sitioWss = esSitio() ? null : crearSitioGateway();   // servidores de sitio: /sitio (token por localidad)

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/sitio' && !sitioWss) {
    socket.destroy();
    return;
  }
  const destino = pathname === '/agent' ? agenteWss : pathname === '/sitio' ? sitioWss : wss;
  destino.handleUpgrade(req, socket, head, (ws) => destino.emit('connection', ws, req));
});

// Broadcast de la balanza: solo a los clientes suscriptos a ese dispositivo (o a todas las de su alcance)
function broadcast(msg) {
  if (esSitio()) reenviarBalanza(msg);   // peso en vivo también al central
  wss.clients.forEach(ws => {
    if (ws.readyState === ws.OPEN && (ws.dispositivoId === msg.dispositivo_id || ws.dispositivos?.has(msg.dispositivo_id))) {
      ws.send(JSON.stringify(msg));
    }
  });
}

// Inicializar servicio de balanzas (una conexión por balanza activa, lee config desde BD)
inicializarBalanzas(broadcast);

// Balanza a la que se suscribe un cliente: la pedida si está en su alcance, si no la primera de su alcance
const resolverBalanzaWs = async (user, requestedId) => {
  const scope = scopeSql('localidad_id', user, 1);
  const requested = /^\d+$/.test(requestedId || '') ? parseInt(requestedId, 10) : null;
  const result = await pool.query(`
    SELECT id FROM configuracion_dispositivos
    WHERE tipo_dispositivo = 'balanza' AND activo = true AND ${scope.sql}
    ORDER BY (id = $3) DESC NULLS LAST, id
    LIMIT 1
  `, [...scope.params, requested]);
  return result.rows[0]?.id ?? null;
};

// Todas las balanzas activas del alcance del usuario (dashboard en vivo)
const balanzasEnAlcance = async (user) => {
  const scope = scopeSql('localidad_id', user, 1);
  const result = await pool.query(`
    SELECT id FROM configuracion_dispositivos
    WHERE tipo_dispositivo = 'balanza' AND activo = true AND ${scope.sql}
  `, scope.params);
  return result.rows.map(r => r.id);
};

// Manejar conexiones WebSocket entrantes: ws://host/ws?dispositivoId=Y (el usuario sale de la cookie de sesión)
// ws://host/ws?todas=1 → peso de todas las balanzas de su alcance (cada mensaje trae dispositivo_id y localidad_id)
wss.on('connection', async (ws, req) => {
  try {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const user = await userFromRequest(req);
    if (!user) {
      ws.close(4401, 'No autorizado');
      return;
    }
    if (params.get('todas') === '1') {
      const ids = await balanzasEnAlcance(user);
      ws.dispositivos = new Set(ids);
      console.log(`🔌 Cliente WebSocket conectado: ${user.username} → ${ids.length} balanza(s) (en vivo)`);
      for (const id of ids) {
        const estado = getEstadoBalanza(id);
        ws.send(JSON.stringify({
          type: 'STATUS',
          status: estado?.connected ? 'CONNECTED' : 'DISCONNECTED',
          currentWeight: estado?.lastWeight ?? null,
          stable: estado?.stable ?? false,
          dispositivo_id: id,
          localidad_id: estado?.localidad_id ?? null,
        }));
      }
      return;
    }

    const dispositivoId = await resolverBalanzaWs(user, params.get('dispositivoId'));
    ws.dispositivoId = dispositivoId;
    console.log(`🔌 Cliente WebSocket conectado: ${user.username} → balanza ${dispositivoId ?? '-'}`);

    const estado = dispositivoId ? getEstadoBalanza(dispositivoId) : null;
    ws.send(JSON.stringify({
      type: 'STATUS',
      status: estado?.connected ? 'CONNECTED' : 'DISCONNECTED',
      currentWeight: estado?.lastWeight ?? null,
      stable: estado?.stable ?? false,
      dispositivo_id: dispositivoId,
      ...(estado?.error && { error: estado.error }),
      ...(!dispositivoId && { error: 'Sin balanza asignada' })
    }));
  } catch (err) {
    console.error('❌ Error en conexión WebSocket:', err.message);
    ws.close(1011, 'Error interno');
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Central/sitio: reenvío de escrituras y bloqueos (antes de las rutas)
app.use(middlewaresDeModo());

// Estado de la sincronización central ↔ sitios
app.get('/api/sitio/estado', requireAuth, async (req, res) => {
  try {
    if (esSitio()) return res.json({ success: true, data: await estadoSync() });
    const r = await pool.query(
      `SELECT id AS localidad_id, nombre, sitio_activo, sitio_ultima_sync, sitio_info,
              (sitio_token_hash IS NOT NULL) AS tiene_token
       FROM localidad WHERE sitio_activo OR sitio_token_hash IS NOT NULL ORDER BY id`);
    const conectados = new Map(estadoSitios().map(s => [s.localidad_id, s.conectado]));
    res.json({
      success: true,
      data: { modo: 'central', sitios: r.rows.map(x => ({ ...x, conectado: conectados.get(x.localidad_id) ?? false })) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rutas API
app.use('/api/choferes', choferesRoutes);
app.use('/api/productores', productoresRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/transportes', transportesRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/pesadas', pesadasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/provincias', provinciasRoutes);
app.use('/api/localidades', localidadesRoutes);
app.use('/api/metricas', metricasRoutes);
app.use('/api/camaras', camarasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/config', configRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/solicitudes-borrado', solicitudesBorradoRoutes);

const CAPTURAS_DIR = path.join(__dirname, "../capturas");
if (!fs.existsSync(CAPTURAS_DIR)) {
  fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
}
app.use("/capturas", requireAuth, express.static(CAPTURAS_DIR));

const DOCUMENTOS_DIR = path.join(__dirname, "documentos");
if (!fs.existsSync(DOCUMENTOS_DIR)) {
  fs.mkdirSync(DOCUMENTOS_DIR, { recursive: true });
}
app.use("/documentos", requireAuth, express.static(DOCUMENTOS_DIR));

// Servir el frontend build
const FRONTEND_DIR = path.join(__dirname, "../../Frontend/dist");
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
}

// Ruta de prueba
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'OK',
      message: '✅ Backend conectado a PostgreSQL',
      timestamp: result.rows[0].now,
      scale: getEstadosBalanzas()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: '❌ Error de conexión a base de datos',
      error: error.message,
    });
  }
});

// Manejo de rutas no encontradas y errores al FINAL
app.use((req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/capturas') || req.path.startsWith('/documentos')) {
    res.status(404).json({
      error: 'Ruta no encontrada',
      path: req.path,
    });
  } else {
    // Para SPA, servir index.html
    if (fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))) {
      res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
    } else {
      res.status(404).send('Frontend no disponible');
    }
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message,
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Backend ejecutándose en http://0.0.0.0:${PORT}`);
  console.log(`   Modo ${esSitio() ? 'sitio' : 'central'} · Health: GET /api/health · WS navegadores: /ws · WS agentes: /agent${esSitio() ? '' : ' · WS sitios: /sitio'}`);
  if (esSitio()) iniciarSitioSync();
});

export default app;
