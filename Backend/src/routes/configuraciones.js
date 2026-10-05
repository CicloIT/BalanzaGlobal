import express from 'express'
import { getConfiguracion, updateConfiguracion } from '../controllers/configuracionControll.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router();

router.get('/', requireAuth, getConfiguracion);
router.put('/:tipo', requireAuth, updateConfiguracion);

export default router;