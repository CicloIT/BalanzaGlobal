import express from 'express';
import {
  getVehiculos,
  getVehiculoById,
  createVehiculo,
  updateVehiculo,
  deleteVehiculo,
  getVehiculosParaSelect
} from '../controllers/vehiculosController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

// 1. Rutas Estáticas (Siempre arriba)
router.get('/select-list', optionalAuth, getVehiculosParaSelect);
router.get('/', optionalAuth, requirePermission(PERMISSIONS.VEHICULOS_VIEW), getVehiculos);

// 2. Rutas con parámetros dinámicos
router.get('/:id', optionalAuth, requirePermission(PERMISSIONS.VEHICULOS_VIEW), getVehiculoById);

// 3. Rutas de escritura
router.post('/', requireAuth, requirePermission(PERMISSIONS.VEHICULOS_CREATE), createVehiculo);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.VEHICULOS_UPDATE), updateVehiculo);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.VEHICULOS_DELETE), deleteVehiculo);

export default router;