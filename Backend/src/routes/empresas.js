import express from 'express';
import {
    getEmpresas,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
    getConfigEmpresaActual,
} from '../controllers/empresasController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

router.get('/actual/config', requireAuth, getConfigEmpresaActual);
router.get('/', requireAuth, requirePermission(PERMISSIONS.EMPRESAS_VIEW), getEmpresas);
router.post('/', requireAuth, requirePermission(PERMISSIONS.EMPRESAS_CREATE), createEmpresa);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.EMPRESAS_UPDATE), updateEmpresa);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.EMPRESAS_DELETE), deleteEmpresa);

export default router;
