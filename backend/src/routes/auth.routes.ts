import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { loginSchema, refreshTokenSchema } from '../validators/auth.validator';

const router = Router();

router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', validate(refreshTokenSchema), AuthController.refresh);
router.post('/logout', authenticateToken, AuthController.logout);
router.get('/me', authenticateToken, AuthController.me);

export default router;

