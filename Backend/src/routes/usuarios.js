import express from 'express';
import {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  authLogin,
} from '../controllers/usuariosController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

// Login es público
router.post('/login', authLogin);

// Rutas protegidas
router.get('/', optionalAuth, requirePermission(PERMISSIONS.USUARIOS_VIEW), getUsuarios);
router.get('/:id', optionalAuth, requirePermission(PERMISSIONS.USUARIOS_VIEW), getUsuarioById);
router.post('/', requireAuth, requirePermission(PERMISSIONS.USUARIOS_CREATE), createUsuario);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.USUARIOS_UPDATE), updateUsuario);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.USUARIOS_DELETE), deleteUsuario);

export default router;
