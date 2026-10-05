import express from 'express';
import { handleManualBackup, listBackups, downloadBackup } from '../controllers/backupController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

// Rutas protegidas (Solo Admin)
router.get('/list', requireAuth, requirePermission(PERMISSIONS.BACKUP_MANAGE), listBackups);
router.get('/download/:filename', requireAuth, requirePermission(PERMISSIONS.BACKUP_MANAGE), downloadBackup);
router.post('/trigger', requireAuth, requirePermission(PERMISSIONS.BACKUP_MANAGE), handleManualBackup);

export default router;
