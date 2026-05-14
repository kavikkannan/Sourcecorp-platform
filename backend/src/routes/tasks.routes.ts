import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { TaskController } from '../controllers/task.controller';
import * as validators from '../validators/admin.validator';

const router = Router();

// All task routes require authentication
router.use(authenticateToken);

// ============================================
// TASK MANAGEMENT
// ============================================
// Specific routes must come before parameterized routes

// Get my tasks
router.get(
  '/my',
  TaskController.getMyTasks
);

// Legacy endpoint for backward compatibility
router.get('/assigned-to-me', TaskController.getTasksAssignedToMe);
router.get('/assigned-by-me', TaskController.getTasksAssignedByMe);

// Get subordinate tasks (manager view)
router.get(
  '/subordinates',
  requirePermission('task.view.subordinates'),
  TaskController.getSubordinateTasks
);

// Create task
router.post(
  '/',
  requireAnyPermission(['task.create.personal', 'task.create.common', 'task.assign.downward', 'task.raise.upward']),
  validate(validators.createTaskSchema),
  TaskController.createTask
);

// Update task status
// NOTE: Authorization is handled at the service layer — only the assigned user can update status.
// We intentionally do NOT require a route-level permission here so that any user who is
// legitimately assigned a task can act on it, regardless of their role permissions.
router.put(
  '/:id/status',
  validate(validators.updateTaskStatusSchema),
  TaskController.updateTaskStatus
);

// Add comment to task
// NOTE: Authorization is handled at the service layer — user must have access to the task.
router.post(
  '/:id/comments',
  validate(validators.addTaskCommentSchema),
  TaskController.addComment
);

// Get task comments
// NOTE: Authorization is handled at the service layer — user must have access to the task.
router.get(
  '/:id/comments',
  validate(validators.taskIdSchema),
  TaskController.getComments
);

// Get task analytics
router.get('/analytics', TaskController.getTaskAnalytics);

// Get task activity history
router.get('/:id/activity', validate(validators.taskIdSchema), TaskController.getTaskActivity);

// Get task by ID
router.get('/:id', validate(validators.taskIdSchema), TaskController.getTask);

// Delete task
router.delete('/:id', validate(validators.taskIdSchema), TaskController.deleteTask);

export default router;

