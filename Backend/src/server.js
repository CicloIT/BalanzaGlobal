process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
import express from 'express';
import cors from 'cors';
import fs from "fs";
import path from "path";
import dotenv from 'dotenv';
import pool from './config/database.js';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from "url";
import { inicializarBalanza, getEstadoBalanza } from './services/balanzaService.js';

// Importar rutas
import choferesRoutes from './routes/choferes.js';
import productoresRoutes from './routes/productores.js';
import productosRoutes from './routes/productos.js';
import transportesRoutes from './routes/transportes.js';
import vehiculosRoutes from './routes/vehiculos.js';
import ticketsRoutes from './routes/tickets.js';
import pesadasRoutes from './routes/pesadas.js';
import usuariosRoutes from './routes/usuarios.js';
import provinciasRoutes from './routes/provincias.js';
import localidadesRoutes from './routes/localidades.js';
import operacionesRoutes from './routes/operaciones.js';
import metricasRoutes from './routes/metricas.js';
import camarasRoutes from './routes/camaras.js';
import reportesRoutes from './routes/reporte.js';
import backupRoutes from './routes/backups.js';
import { createBackup } from './controllers/backupController.js';
import configRoutes from './routes/configuraciones.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Crear servidor HTTP y WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Función de broadcast para WebSockets
function broadcast(msg) {
  wss.clients.forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  });
}

// Inicializar servicio de balanza (lee config desde BD)
inicializarBalanza(broadcast);

// Manejar conexiones WebSocket entrantes
wss.on('connection', (ws) => {
  console.log('🔌 Nuevo cliente WebSocket conectado');
  const estado = getEstadoBalanza();
  ws.send(JSON.stringify({
    type: 'STATUS',
    status: estado.connected ? 'CONNECTED' : 'DISCONNECTED',
    currentWeight: estado.lastWeight
  }));
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Rutas API
app.use('/api/choferes', choferesRoutes);
app.use('/api/productores', productoresRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/transportes', transportesRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/pesadas', pesadasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/provincias', provinciasRoutes);
app.use('/api/localidades', localidadesRoutes);
app.use('/api/operaciones', operacionesRoutes);
app.use('/api/metricas', metricasRoutes);
app.use('/api/camaras', camarasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/config', configRoutes);

const CAPTURAS_DIR = path.join(__dirname, "../capturas");
if (!fs.existsSync(CAPTURAS_DIR)) {
  fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
}
app.use("/capturas", express.static(CAPTURAS_DIR));

const DOCUMENTOS_DIR = path.join(__dirname, "documentos");
if (!fs.existsSync(DOCUMENTOS_DIR)) {
  fs.mkdirSync(DOCUMENTOS_DIR, { recursive: true });
}
app.use("/documentos", express.static(DOCUMENTOS_DIR));

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
      scale: getEstadoBalanza()
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
  console.log(`🌐 Accesible desde la red local en: http://[TU_IP_LOCAL]:${PORT}`);
  console.log(`📡 Endpoints disponibles:`);
  console.log(`   GET  /api/health              - Verificar conexión`);
  console.log(`   GET  /api/choferes            - Listar choferes`);
  console.log(`   GET  /api/productores         - Listar productores`);
  console.log(`   GET  /api/productos           - Listar productos`);
  console.log(`   GET  /api/transportes         - Listar transportes`);
  console.log(`   GET  /api/vehiculos           - Listar vehículos`);
  console.log(`   GET  /api/tickets             - Listar tickets`);
  console.log(`   GET  /api/pesadas             - Listar pesadas`);
  console.log(`   GET  /api/usuarios            - Listar usuarios`);
  console.log(`   GET  /api/camaras             - Captura NVR`);
  console.log(`   GET  /api/reportes            - Listar reportes\n`);

  // Tarea programada semanal para backup (Domingo a las 00:00)
  // Check cada hora si es Domingo y hora 0.
  setInterval(async () => {
    const ahora = new Date();
    // 0 es Domingo, hora 3 AM (para no interferir con el uso)
    if (ahora.getDay() === 0 && ahora.getHours() === 3) {
      console.log('⏰ Iniciando backup automático semanal...');
      try {
        const localidadId = process.env.LOCALIDAD_ID ? parseInt(process.env.LOCALIDAD_ID) : null;
        await createBackup(localidadId);
      } catch (err) {
        console.error('❌ Falló el backup automático:', err.message);
      }
    }
  }, 1000 * 60 * 60); // Cada hora
});

export default app;
