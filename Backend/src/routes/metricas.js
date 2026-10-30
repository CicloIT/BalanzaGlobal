import { Router } from 'express';
import { getMetricasDashboard, getEnVivo } from '../controllers/metricasController.js';
import { requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = Router();

// GET /api/metricas/dashboard - Métricas completas para el dashboard
router.get('/dashboard', optionalAuth, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getMetricasDashboard);

// GET /api/metricas/en-vivo - Estado actual por localidad (balanzas, operaciones abiertas, últimas pesadas)
router.get('/en-vivo', optionalAuth, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getEnVivo);

export default router;
