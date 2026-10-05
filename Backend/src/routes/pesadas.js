import express from 'express';
import {
  getPesadas,
  getPesadasByTicket,
  getPesadaById,
  createPesada,
  updatePesada,
  deletePesada,
  getPesadasAgrupadas,
  updatePdfByOperacion,
  updateContenedorByOperacion,
  getPesadaActivaByPatente,
  deleteOperacionesMasivo
} from '../controllers/pesadasController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCUMENTOS_DIR = path.join(__dirname, '..', 'documentos');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOCUMENTOS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cpe-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  }
});

const router = express.Router();

// Rutas de lectura (solo requieren permiso de ver)
router.get('/', optionalAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getPesadas);
router.get('/agrupadas', optionalAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getPesadasAgrupadas);
router.get('/ticket/:ticketId', optionalAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getPesadasByTicket);
router.get('/activa/:patente', optionalAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getPesadaActivaByPatente);
router.get('/:id', optionalAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getPesadaById);

// Rutas de escritura (requieren autenticación y permisos específicos)
router.post('/', requireAuth, requirePermission(PERMISSIONS.PESAJE_CREATE), upload.single('archivo'), createPesada);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.PESAJE_UPDATE), upload.single('archivo'), updatePesada);
router.put('/operacion/:operacionId/contenedor', requireAuth, requirePermission(PERMISSIONS.PESAJE_UPDATE), updateContenedorByOperacion);
router.put('/operacion/:operacionId', requireAuth, requirePermission(PERMISSIONS.PESAJE_UPDATE), upload.single('archivo'), updatePdfByOperacion);
router.delete('/operacion/:operacionId', requireAuth, requirePermission(PERMISSIONS.PESAJE_DELETE), deletePesada);
router.post('/operaciones/delete-masivo', requireAuth, requirePermission(PERMISSIONS.PESAJE_DELETE), deleteOperacionesMasivo);

export default router;
