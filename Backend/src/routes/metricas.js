import { Router } from 'express';
import { getMetricasDashboard } from '../controllers/metricasController.js';
import { requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = Router();

// GET /api/metricas/dashboard - Métricas completas para el dashboard
router.get('/dashboard', optionalAuth, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getMetricasDashboard);

export default router;
