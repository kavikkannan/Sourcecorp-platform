import { Response } from 'express';
import { AuthRequest } from '../types';
import { TaskService } from '../services/task.service';
import { AuditService } from '../services/audit.service';

export class TaskController {
  /**
   * POST /api/tasks
   * Create a new task
   */
  static async createTask(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { title, description, assignedTo, taskType, direction, priority, linkedCaseId, dueDate } = req.body;

      const task = await TaskService.createTask(
        title,
        description || null,
        assignedTo,
        req.user.userId,
        taskType,
        direction || null,
        priority || 'MEDIUM',
        linkedCaseId || null,
        dueDate ? new Date(dueDate) : null,
        req.userPermissions || []
      );

      // Audit log
      await AuditService.createLog({
        userId: req.user.userId,
        action: 'task.create',
        resourceType: 'task',
        resourceId: task.id,
        details: {
          title,
          taskType,
          assignedTo,
          direction,
          priority,
          linkedCaseId,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(task);
    } catch (error: any) {
      if (
        error.message.includes('DOWNWARD tasks can only be assigned') ||
        error.message.includes('UPWARD tasks can only be raised') ||
        error.message.includes('PERSONAL tasks must be assigned') ||
        error.message.includes('Insufficient permissions') ||
        error.message.includes('Access denied')
      ) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * GET /api/tasks/:id
   * Get a task by ID
   */
  static async getTask(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const task = await TaskService.getTask(id, req.user.userId);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/tasks/my
   * Get my tasks (assigned to me)
   */
  static async getMyTasks(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const status = req.query.status as 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | undefined;
      const priority = req.query.priority as 'LOW' | 'MEDIUM' | 'HIGH' | undefined;
      const taskType = req.query.taskType as 'PERSONAL' | 'COMMON' | 'HIERARCHICAL' | undefined;

      const tasks = await TaskService.getMyTasks(req.user.userId, status, priority, taskType);

      res.json(tasks);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/tasks/assigned-to-me
   * Get tasks assigned to the current user (legacy endpoint)
   */
  static async getTasksAssignedToMe(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const status = req.query.status as 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | undefined;
      const tasks = await TaskService.getTasksAssignedTo(req.user.userId, status);

      res.json(tasks);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/tasks/assigned-by-me
   * Get tasks assigned by the current user
   */
  static async getTasksAssignedByMe(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const status = req.query.status as 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | undefined;
      const tasks = await TaskService.getTasksAssignedBy(req.user.userId, status);

      res.json(tasks);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/tasks/subordinates
   * Get tasks for subordinates (manager view)
   */
  static async getSubordinateTasks(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const status = req.query.status as 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | undefined;
      const tasks = await TaskService.getSubordinateTasks(req.user.userId, status);

      res.json(tasks);
    } catch (error) {
      throw error;
    }
  }

  /**
   * PUT /api/tasks/:id/status
   * Update task status
   */
  static async updateTaskStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!['OPEN', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const task = await TaskService.updateTaskStatus(id, status, req.user.userId);

      // Audit log
      await AuditService.createLog({
        userId: req.user.userId,
        action: 'task.status.update',
        resourceType: 'task',
        resourceId: task.id,
        details: {
          status,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(task);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Only the assigned user')) {
        return res.status(403).json({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * POST /api/tasks/:id/comments
   * Add a comment to a task
   */
  static async addComment(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { comment } = req.body;

      if (!comment || comment.trim().length === 0) {
        return res.status(400).json({ error: 'Comment is required' });
      }

      const taskComment = await TaskService.addComment(id, comment, req.user.userId);

      // Audit log
      await AuditService.createLog({
        userId: req.user.userId,
        action: 'task.comment.add',
        resourceType: 'task',
        resourceId: id,
        details: {
          commentId: taskComment.id,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(taskComment);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * GET /api/tasks/:id/comments
   * Get comments for a task
   */
  static async getComments(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const comments = await TaskService.getComments(id, req.user.userId);

      res.json(comments);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * DELETE /api/tasks/:id
   * Delete a task
   */
  static async deleteTask(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;

      await TaskService.deleteTask(id, req.user.userId);

      // Audit log
      await AuditService.createLog({
        userId: req.user.userId,
        action: 'task.delete',
        resourceType: 'task',
        resourceId: id,
        details: {},
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Task deleted successfully' });
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Only the task creator')) {
        return res.status(403).json({ error: error.message });
      }
      throw error;
    }
  }
}
