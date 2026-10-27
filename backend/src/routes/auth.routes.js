import { Router } from 'express';
import { register, login, logout, getMe, switchBusiness } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Rate limiters for authentication endpoints to mitigate brute force & credential stuffing
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts from this IP. Please try again after 15 minutes.'
});

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts from this IP. Please try again after 15 minutes.'
});

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.post('/switch-business', requireAuth, switchBusiness);

export default router;
