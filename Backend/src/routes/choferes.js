import express from 'express';
import {
  getChoferes,
  getChoferById,
  createChofer,
  updateChofer,
  deleteChofer,
} from '../controllers/choferesController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

router.get('/', optionalAuth, requirePermission(PERMISSIONS.CHOFERES_VIEW), getChoferes);
router.get('/:id', optionalAuth, requirePermission(PERMISSIONS.CHOFERES_VIEW), getChoferById);
router.post('/', requireAuth, requirePermission(PERMISSIONS.CHOFERES_CREATE), createChofer);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.CHOFERES_UPDATE), updateChofer);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.CHOFERES_DELETE), deleteChofer);

export default router;
