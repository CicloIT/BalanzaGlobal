import express from 'express';
import {
    getProvincias,
    createProvincia,
    updateProvincia,
    deleteProvincia
} from '../controllers/provinciasController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

router.get('/', optionalAuth, requirePermission(PERMISSIONS.PROVINCIAS_VIEW), getProvincias);
router.post('/', requireAuth, requirePermission(PERMISSIONS.PROVINCIAS_CREATE), createProvincia);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.PROVINCIAS_UPDATE), updateProvincia);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.PROVINCIAS_DELETE), deleteProvincia);

export default router;
