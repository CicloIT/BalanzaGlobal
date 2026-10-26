import express from 'express';
import { handleManualBackup, listBackups, downloadBackup } from '../controllers/backupController.js';
import { requireAuth, requirePermission, requireGlobal } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

// Respaldo completo de la base: solo admin global y superadmin
const soloAdminGlobal = [requireAuth, requirePermission(PERMISSIONS.BACKUP_MANAGE), requireGlobal];
router.get('/list', soloAdminGlobal, listBackups);
router.get('/download/:filename', soloAdminGlobal, downloadBackup);
router.post('/trigger', soloAdminGlobal, handleManualBackup);

export default router;
