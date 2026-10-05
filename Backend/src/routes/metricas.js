import { Router } from 'express';
import {
  getMetricasDashboard,
  getMetricasPorFecha,
  getComparativoMensual
} from '../controllers/metricasController.js';
import { requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = Router();

// GET /api/metricas/dashboard - Métricas completas para el dashboard
router.get('/dashboard', optionalAuth, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getMetricasDashboard);

// GET /api/metricas/por-fecha - Métricas filtradas por rango de fechas
router.get('/por-fecha', optionalAuth, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getMetricasPorFecha);

// GET /api/metricas/comparativo-mensual - Comparativo de los últimos 6 meses
router.get('/comparativo-mensual', optionalAuth, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getComparativoMensual);

export default router;
