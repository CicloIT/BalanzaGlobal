import express from 'express';
import {
  getProductores,
  getProductorById,
  createProductor,
  updateProductor,
  deleteProductor,
} from '../controllers/productoresController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

router.get('/', optionalAuth, requirePermission(PERMISSIONS.PRODUCTORES_VIEW), getProductores);
router.get('/:id', optionalAuth, requirePermission(PERMISSIONS.PRODUCTORES_VIEW), getProductorById);
router.post('/', requireAuth, requirePermission(PERMISSIONS.PRODUCTORES_CREATE), createProductor);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.PRODUCTORES_UPDATE), updateProductor);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.PRODUCTORES_DELETE), deleteProductor);

export default router;
