import express from 'express';
import {
  getTransportes,
  getTransporteById,
  createTransporte,
  updateTransporte,
  deleteTransporte,
} from '../controllers/transportesController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

router.get('/', optionalAuth, requirePermission(PERMISSIONS.TRANSPORTES_VIEW), getTransportes);
router.get('/:id', optionalAuth, requirePermission(PERMISSIONS.TRANSPORTES_VIEW), getTransporteById);
router.post('/', requireAuth, requirePermission(PERMISSIONS.TRANSPORTES_CREATE), createTransporte);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.TRANSPORTES_UPDATE), updateTransporte);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.TRANSPORTES_DELETE), deleteTransporte);

export default router;
