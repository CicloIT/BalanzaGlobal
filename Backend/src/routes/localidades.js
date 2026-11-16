import express from 'express';
import {
    getLocalidades,
    createLocalidad,
    updateLocalidad,
    updateModulos,
    deleteLocalidad,
    generarTokenSitioLocalidad,
    revocarTokenSitioLocalidad
} from '../controllers/localidadesController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

router.get('/', optionalAuth, requirePermission(PERMISSIONS.LOCALIDADES_VIEW), getLocalidades);
router.post('/', requireAuth, requirePermission(PERMISSIONS.LOCALIDADES_CREATE), createLocalidad);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.LOCALIDADES_UPDATE), updateLocalidad);
router.put('/:id/modulos', requireAuth, updateModulos);
router.post('/:id/sitio-token', requireAuth, generarTokenSitioLocalidad);
router.delete('/:id/sitio-token', requireAuth, revocarTokenSitioLocalidad);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.LOCALIDADES_DELETE), deleteLocalidad);

export default router;
