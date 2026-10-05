import express from 'express';
import {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto,
} from '../controllers/productosController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

router.get('/', optionalAuth, requirePermission(PERMISSIONS.PRODUCTOS_VIEW), getProductos);
router.get('/:id', optionalAuth, requirePermission(PERMISSIONS.PRODUCTOS_VIEW), getProductoById);
router.post('/', requireAuth, requirePermission(PERMISSIONS.PRODUCTOS_CREATE), createProducto);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.PRODUCTOS_UPDATE), updateProducto);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.PRODUCTOS_DELETE), deleteProducto);

export default router;
