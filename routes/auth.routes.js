import { Router } from 'express';
import { showLogin, handleLogin } from '../controllers/auth.controller.js';

const router = Router();

router.get('/', showLogin);
router.post('/login', handleLogin);

export default router;