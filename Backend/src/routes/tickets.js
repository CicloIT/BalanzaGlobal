import express from 'express';
import {
  getTickets,
  getTicketById,
  getTicketsByEstado,
  createTicket,
  updateTicket,
  closeTicket,
  getTicketsByDateRange,
} from '../controllers/ticketsController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

router.get('/', optionalAuth, requirePermission(PERMISSIONS.TICKETS_VIEW), getTickets);
router.get('/estado/:estado', optionalAuth, requirePermission(PERMISSIONS.TICKETS_VIEW), getTicketsByEstado);
router.get('/fecha/rango', optionalAuth, requirePermission(PERMISSIONS.TICKETS_VIEW), getTicketsByDateRange);
router.get('/:id', optionalAuth, requirePermission(PERMISSIONS.TICKETS_VIEW), getTicketById);
router.post('/', requireAuth, requirePermission(PERMISSIONS.TICKETS_CREATE), createTicket);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.TICKETS_UPDATE), updateTicket);
router.post('/:id/cerrar', requireAuth, requirePermission(PERMISSIONS.TICKETS_CLOSE), closeTicket);

export default router;
