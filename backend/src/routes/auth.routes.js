import { Router } from 'express';
import { register, login, logout, getMe, switchBusiness } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.post('/switch-business', requireAuth, switchBusiness);

export default router;
