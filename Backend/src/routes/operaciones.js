import express from 'express';
import {
    getOperaciones,
    getOperacionAbiertaByPatente,
    closeOperacion
} from '../controllers/operacionesController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

router.get('/', optionalAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getOperaciones);
router.get('/abierta/:patente', optionalAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getOperacionAbiertaByPatente);
router.post('/:id/cerrar', requireAuth, requirePermission(PERMISSIONS.PESAJE_UPDATE), closeOperacion);

export default router;
