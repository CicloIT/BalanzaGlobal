import express from 'express';
import {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  authLogin,
  authLogout,
  getSesion,
  cambiarPasswordPropia,
} from '../controllers/usuariosController.js';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../config/rolesConfig.js';

const router = express.Router();

// Login y logout son públicos
router.post('/login', authLogin);
router.post('/logout', authLogout);

// Sesión actual (antes de /:id)
router.get('/me', requireAuth, getSesion);
router.put('/me/password', requireAuth, cambiarPasswordPropia);

// Rutas protegidas
router.get('/', optionalAuth, requirePermission(PERMISSIONS.USUARIOS_VIEW), getUsuarios);
router.get('/:id', optionalAuth, requirePermission(PERMISSIONS.USUARIOS_VIEW), getUsuarioById);
router.post('/', requireAuth, requirePermission(PERMISSIONS.USUARIOS_CREATE), createUsuario);
router.put('/:id', requireAuth, requirePermission(PERMISSIONS.USUARIOS_UPDATE), updateUsuario);
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.USUARIOS_DELETE), deleteUsuario);

export default router;
