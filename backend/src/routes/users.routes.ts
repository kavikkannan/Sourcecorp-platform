import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { HierarchyController } from '../controllers/hierarchy.controller';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

// ============================================
// HIERARCHY (USER LEVEL)
// ============================================
router.get('/me/manager', HierarchyController.getMyManager);
router.get('/me/subordinates', HierarchyController.getMySubordinates);

export default router;

