import express from 'express'
import { getConfiguracion, updateConfiguracion, getBalanzas } from '../controllers/configuracionControll.js'
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js'
import { PERMISSIONS } from '../config/rolesConfig.js'

const router = express.Router();

router.get('/', requireAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getConfiguracion);
router.get('/balanzas', requireAuth, requirePermission(PERMISSIONS.PESAJE_VIEW), getBalanzas);
router.put('/:tipo', requireAuth, requirePermission(PERMISSIONS.BACKUP_MANAGE), updateConfiguracion);

export default router;
