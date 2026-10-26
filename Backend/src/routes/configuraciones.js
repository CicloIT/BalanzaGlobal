import express from 'express'
import { getConfiguracion, updateConfiguracion, getBalanzas, generarToken, revocarToken } from '../controllers/configuracionController.js'
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js'
import { PERMISSIONS } from '../config/rolesConfig.js'

const router = express.Router();

// Config de dispositivos (ip/puerto, credenciales NVR, tokens de agente): solo admin y superadmin
router.get('/', requireAuth, requirePermission(PERMISSIONS.DISPOSITIVOS_MANAGE), getConfiguracion);
router.get('/balanzas', requireAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getBalanzas);
router.post('/balanza/token', requireAuth, requirePermission(PERMISSIONS.DISPOSITIVOS_MANAGE), generarToken);
router.delete('/balanza/token', requireAuth, requirePermission(PERMISSIONS.DISPOSITIVOS_MANAGE), revocarToken);
router.put('/:tipo', requireAuth, requirePermission(PERMISSIONS.DISPOSITIVOS_MANAGE), updateConfiguracion);

export default router;
