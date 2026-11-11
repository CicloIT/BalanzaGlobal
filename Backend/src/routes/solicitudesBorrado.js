import express from 'express';
import {
  getSolicitudes,
  contarPendientes,
  aprobarSolicitud,
  rechazarSolicitud,
} from '../controllers/solicitudesBorradoController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

// Bandeja de pedidos de borrado: solo quien puede borrar operaciones (superadmin)
const router = express.Router();
const puedeBorrar = [requireAuth, requirePermission(PERMISSIONS.PESAJE_DELETE)];

router.get('/', ...puedeBorrar, getSolicitudes);
router.get('/pendientes/count', ...puedeBorrar, contarPendientes);
router.post('/:id/aprobar', ...puedeBorrar, aprobarSolicitud);
router.post('/:id/rechazar', ...puedeBorrar, rechazarSolicitud);

export default router;
