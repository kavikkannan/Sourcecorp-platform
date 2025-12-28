import { query } from '../db/pool';
import { Task, TaskWithUsers, TaskComment, User, Case } from '../types';
import { HierarchyService } from './hierarchy.service';
import { CRMService } from './crm.service';
import { logger } from '../config/logger';

export class TaskService {
  /**
   * Create a new task with validation based on task type
   */
  static async createTask(
    title: string,
    description: string | null,
    assignedTo: string,
    assignedBy: string,
    taskType: 'PERSONAL' | 'COMMON' | 'HIERARCHICAL',
    direction: 'DOWNWARD' | 'UPWARD' | null,
    priority: 'LOW' | 'MEDIUM' | 'HIGH',
    linkedCaseId: string | null,
    dueDate: Date | null = null,
    userPermissions: string[] = []
  ): Promise<Task> {
    // Validate task type specific rules
    if (taskType === 'PERSONAL') {
      // Personal tasks must be assigned to self
      if (assignedTo !== assignedBy) {
        throw new Error('PERSONAL tasks must be assigned to the creator');
      }
      if (direction !== null) {
        throw new Error('PERSONAL tasks cannot have a direction');
      }
    } else if (taskType === 'COMMON') {
      // Common tasks require permission
      if (!userPermissions.includes('task.create.common')) {
        throw new Error('Insufficient permissions to create COMMON tasks');
      }
      if (direction !== null) {
        throw new Error('COMMON tasks cannot have a direction');
      }
    } else if (taskType === 'HIERARCHICAL') {
      // Hierarchical tasks require direction
      if (!direction) {
        throw new Error('HIERARCHICAL tasks must have a direction');
      }
      
      // Validate hierarchy relationship based on direction
      if (direction === 'DOWNWARD') {
        // Check if assignedTo is a subordinate of assignedBy
        const isSubordinate = await HierarchyService.isSubordinateOf(
          assignedTo,
          assignedBy
        );

        if (!isSubordinate) {
          throw new Error('DOWNWARD tasks can only be assigned to subordinates');
        }
      } else if (direction === 'UPWARD') {
        // Check if assignedTo is the manager of assignedBy
        const manager = await HierarchyService.getManager(assignedBy);
        if (!manager || manager.id !== assignedTo) {
          throw new Error('UPWARD tasks can only be raised to direct manager');
        }
      }
    }

    // Validate case access if linked
    if (linkedCaseId) {
      // Get user role for case access check
      const userResult = await query(
        `SELECT r.name as role_name
         FROM auth_schema.users u
         LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
         LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
         WHERE u.id = $1
         LIMIT 1`,
        [assignedBy]
      );

      const userRole = userResult.rows[0]?.role_name || 'employee';

      // Check case access
      const caseCheck = await query(
        `SELECT id FROM crm_schema.cases WHERE id = $1`,
        [linkedCaseId]
      );

      if (caseCheck.rows.length === 0) {
        throw new Error('Linked case not found');
      }

      // RBAC check for case access
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        const accessCheck = await query(
          `SELECT 1 FROM crm_schema.cases c
           LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
           WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
          [linkedCaseId, assignedBy]
        );

        if (accessCheck.rows.length === 0) {
          throw new Error('Access denied to linked case');
        }
      }
    }

    // Insert the task
    const result = await query(
      `INSERT INTO task_schema.tasks 
       (title, description, assigned_to, assigned_by, task_type, direction, priority, linked_case_id, status, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', $9)
       RETURNING id, title, description, assigned_to, assigned_by, task_type, direction, priority, linked_case_id, status, due_date, created_at, updated_at`,
      [title, description || null, assignedTo, assignedBy, taskType, direction, priority, linkedCaseId, dueDate]
    );

    return result.rows[0];
  }

  /**
   * Get a task by ID with user details and case info
   */
  static async getTask(taskId: string, userId?: string): Promise<TaskWithUsers | null> {
    let queryStr = `
      SELECT t.*,
             u1.id as assignee_id, u1.email as assignee_email, 
             u1.first_name as assignee_first_name, u1.last_name as assignee_last_name,
             u2.id as assigner_id, u2.email as assigner_email,
             u2.first_name as assigner_first_name, u2.last_name as assigner_last_name,
             c.id as case_id, c.case_number, c.customer_name
      FROM task_schema.tasks t
      JOIN auth_schema.users u1 ON t.assigned_to = u1.id
      JOIN auth_schema.users u2 ON t.assigned_by = u2.id
      LEFT JOIN crm_schema.cases c ON t.linked_case_id = c.id
      WHERE t.id = $1
    `;

    const params: any[] = [taskId];

    // If userId provided, ensure user has access
    if (userId) {
      queryStr += ` AND (t.assigned_to = $2 OR t.assigned_by = $2)`;
      params.push(userId);
    }

    const result = await query(queryStr, params);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const task: TaskWithUsers = {
      id: row.id,
      title: row.title,
      description: row.description,
      assigned_to: row.assigned_to,
      assigned_by: row.assigned_by,
      task_type: row.task_type,
      direction: row.direction,
      priority: row.priority,
      linked_case_id: row.linked_case_id,
      status: row.status,
      due_date: row.due_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      assignee: {
        id: row.assignee_id,
        email: row.assignee_email,
        first_name: row.assignee_first_name,
        last_name: row.assignee_last_name,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      assigner: {
        id: row.assigner_id,
        email: row.assigner_email,
        first_name: row.assigner_first_name,
        last_name: row.assigner_last_name,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    };

    if (row.case_id) {
      task.linked_case = {
        id: row.case_id,
        case_number: row.case_number,
        customer_name: row.customer_name,
        customer_email: '',
        customer_phone: '',
        loan_type: '',
        loan_amount: 0,
        source_type: null,
        current_status: '',
        created_by: '',
        created_at: new Date(),
        updated_at: new Date(),
      };
    }

    return task;
  }

  /**
   * Get my tasks (assigned to me) - includes personal, common, and hierarchical
   */
  static async getMyTasks(
    userId: string,
    status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED',
    priority?: 'LOW' | 'MEDIUM' | 'HIGH',
    taskType?: 'PERSONAL' | 'COMMON' | 'HIERARCHICAL'
  ): Promise<TaskWithUsers[]> {
    let queryStr = `
      SELECT t.*,
             u1.id as assignee_id, u1.email as assignee_email,
             u1.first_name as assignee_first_name, u1.last_name as assignee_last_name,
             u2.id as assigner_id, u2.email as assigner_email,
             u2.first_name as assigner_first_name, u2.last_name as assigner_last_name,
             c.id as case_id, c.case_number, c.customer_name
      FROM task_schema.tasks t
      JOIN auth_schema.users u1 ON t.assigned_to = u1.id
      JOIN auth_schema.users u2 ON t.assigned_by = u2.id
      LEFT JOIN crm_schema.cases c ON t.linked_case_id = c.id
      WHERE t.assigned_to = $1
    `;

    const params: any[] = [userId];

    if (status) {
      queryStr += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    if (priority) {
      queryStr += ` AND t.priority = $${params.length + 1}`;
      params.push(priority);
    }

    if (taskType) {
      queryStr += ` AND t.task_type = $${params.length + 1}`;
      params.push(taskType);
    }

    queryStr += ` ORDER BY 
      CASE t.priority 
        WHEN 'HIGH' THEN 1 
        WHEN 'MEDIUM' THEN 2 
        WHEN 'LOW' THEN 3 
      END,
      t.due_date NULLS LAST,
      t.created_at DESC`;

    const result = await query(queryStr, params);

    return result.rows.map((row) => {
      const task: TaskWithUsers = {
        id: row.id,
        title: row.title,
        description: row.description,
        assigned_to: row.assigned_to,
        assigned_by: row.assigned_by,
        task_type: row.task_type,
        direction: row.direction,
        priority: row.priority,
        linked_case_id: row.linked_case_id,
        status: row.status,
        due_date: row.due_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assignee: {
          id: row.assignee_id,
          email: row.assignee_email,
          first_name: row.assignee_first_name,
          last_name: row.assignee_last_name,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        assigner: {
          id: row.assigner_id,
          email: row.assigner_email,
          first_name: row.assigner_first_name,
          last_name: row.assigner_last_name,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      };

      if (row.case_id) {
        task.linked_case = {
          id: row.case_id,
          case_number: row.case_number,
          customer_name: row.customer_name,
          customer_email: '',
          customer_phone: '',
          loan_type: '',
          loan_amount: 0,
          source_type: null,
          current_status: '',
          created_by: '',
          created_at: new Date(),
          updated_at: new Date(),
        };
      }

      return task;
    });
  }

  /**
   * Get tasks assigned to a user (legacy method for backward compatibility)
   */
  static async getTasksAssignedTo(
    userId: string,
    status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'
  ): Promise<TaskWithUsers[]> {
    return this.getMyTasks(userId, status);
  }

  /**
   * Get tasks assigned by a user
   */
  static async getTasksAssignedBy(
    userId: string,
    status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'
  ): Promise<TaskWithUsers[]> {
    let queryStr = `
      SELECT t.*,
             u1.id as assignee_id, u1.email as assignee_email,
             u1.first_name as assignee_first_name, u1.last_name as assignee_last_name,
             u2.id as assigner_id, u2.email as assigner_email,
             u2.first_name as assigner_first_name, u2.last_name as assigner_last_name,
             c.id as case_id, c.case_number, c.customer_name
      FROM task_schema.tasks t
      JOIN auth_schema.users u1 ON t.assigned_to = u1.id
      JOIN auth_schema.users u2 ON t.assigned_by = u2.id
      LEFT JOIN crm_schema.cases c ON t.linked_case_id = c.id
      WHERE t.assigned_by = $1
    `;

    const params: any[] = [userId];

    if (status) {
      queryStr += ` AND t.status = $2`;
      params.push(status);
    }

    queryStr += ` ORDER BY t.created_at DESC`;

    const result = await query(queryStr, params);

    return result.rows.map((row) => {
      const task: TaskWithUsers = {
        id: row.id,
        title: row.title,
        description: row.description,
        assigned_to: row.assigned_to,
        assigned_by: row.assigned_by,
        task_type: row.task_type,
        direction: row.direction,
        priority: row.priority,
        linked_case_id: row.linked_case_id,
        status: row.status,
        due_date: row.due_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assignee: {
          id: row.assignee_id,
          email: row.assignee_email,
          first_name: row.assignee_first_name,
          last_name: row.assignee_last_name,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        assigner: {
          id: row.assigner_id,
          email: row.assigner_email,
          first_name: row.assigner_first_name,
          last_name: row.assigner_last_name,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      };

      if (row.case_id) {
        task.linked_case = {
          id: row.case_id,
          case_number: row.case_number,
          customer_name: row.customer_name,
          customer_email: '',
          customer_phone: '',
          loan_type: '',
          loan_amount: 0,
          source_type: null,
          current_status: '',
          created_by: '',
          created_at: new Date(),
          updated_at: new Date(),
        };
      }

      return task;
    });
  }

  /**
   * Get tasks for subordinates of a manager
   */
  static async getSubordinateTasks(
    managerId: string,
    status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'
  ): Promise<TaskWithUsers[]> {
    // Get all subordinates (direct and indirect)
    const subordinates = await HierarchyService.getAllSubordinates(managerId);
    const subordinateIds = subordinates.map((s) => s.id);

    if (subordinateIds.length === 0) {
      return [];
    }

    // Build query with IN clause
    const placeholders = subordinateIds.map((_, i) => `$${i + 1}`).join(', ');
    let queryStr = `
      SELECT t.*,
             u1.id as assignee_id, u1.email as assignee_email,
             u1.first_name as assignee_first_name, u1.last_name as assignee_last_name,
             u2.id as assigner_id, u2.email as assigner_email,
             u2.first_name as assigner_first_name, u2.last_name as assigner_last_name,
             c.id as case_id, c.case_number, c.customer_name
      FROM task_schema.tasks t
      JOIN auth_schema.users u1 ON t.assigned_to = u1.id
      JOIN auth_schema.users u2 ON t.assigned_by = u2.id
      LEFT JOIN crm_schema.cases c ON t.linked_case_id = c.id
      WHERE t.assigned_to IN (${placeholders})
    `;

    const params: any[] = [...subordinateIds];

    if (status) {
      queryStr += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    queryStr += ` ORDER BY t.created_at DESC`;

    const result = await query(queryStr, params);

    return result.rows.map((row) => {
      const task: TaskWithUsers = {
        id: row.id,
        title: row.title,
        description: row.description,
        assigned_to: row.assigned_to,
        assigned_by: row.assigned_by,
        task_type: row.task_type,
        direction: row.direction,
        priority: row.priority,
        linked_case_id: row.linked_case_id,
        status: row.status,
        due_date: row.due_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assignee: {
          id: row.assignee_id,
          email: row.assignee_email,
          first_name: row.assignee_first_name,
          last_name: row.assignee_last_name,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        assigner: {
          id: row.assigner_id,
          email: row.assigner_email,
          first_name: row.assigner_first_name,
          last_name: row.assigner_last_name,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      };

      if (row.case_id) {
        task.linked_case = {
          id: row.case_id,
          case_number: row.case_number,
          customer_name: row.customer_name,
          customer_email: '',
          customer_phone: '',
          loan_type: '',
          loan_amount: 0,
          source_type: null,
          current_status: '',
          created_by: '',
          created_at: new Date(),
          updated_at: new Date(),
        };
      }

      return task;
    });
  }

  /**
   * Update task status
   */
  static async updateTaskStatus(
    taskId: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED',
    userId: string
  ): Promise<Task> {
    // Verify user has access to this task
    const task = await this.getTask(taskId, userId);
    if (!task) {
      throw new Error('Task not found or access denied');
    }

    // Only the assignee can update status
    if (task.assigned_to !== userId) {
      throw new Error('Only the assigned user can update task status');
    }

    const result = await query(
      `UPDATE task_schema.tasks
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, title, description, assigned_to, assigned_by, task_type, direction, priority, linked_case_id, status, due_date, created_at, updated_at`,
      [status, taskId]
    );

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    return result.rows[0];
  }

  /**
   * Delete a task (only by assigner or admin)
   */
  static async deleteTask(taskId: string, userId: string): Promise<void> {
    // Verify user has access
    const task = await this.getTask(taskId, userId);
    if (!task) {
      throw new Error('Task not found or access denied');
    }

    // Only the assigner can delete
    if (task.assigned_by !== userId) {
      throw new Error('Only the task creator can delete the task');
    }

    await query(
      `DELETE FROM task_schema.tasks WHERE id = $1`,
      [taskId]
    );
  }

  /**
   * Add a comment to a task
   */
  static async addComment(
    taskId: string,
    comment: string,
    userId: string
  ): Promise<TaskComment> {
    // Verify user has access to this task
    const task = await this.getTask(taskId, userId);
    if (!task) {
      throw new Error('Task not found or access denied');
    }

    const result = await query(
      `INSERT INTO task_schema.task_comments (task_id, comment, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, task_id, comment, created_by, created_at`,
      [taskId, comment, userId]
    );

    const commentRow = result.rows[0];

    // Get creator info
    const userResult = await query(
      `SELECT id, email, first_name, last_name, is_active, created_at, updated_at
       FROM auth_schema.users WHERE id = $1`,
      [userId]
    );

    const user = userResult.rows[0];

    return {
      id: commentRow.id,
      task_id: commentRow.task_id,
      comment: commentRow.comment,
      created_by: commentRow.created_by,
      created_at: commentRow.created_at,
      creator: user ? {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      } : undefined,
    };
  }

  /**
   * Get comments for a task
   */
  static async getComments(taskId: string, userId: string): Promise<TaskComment[]> {
    // Verify user has access to this task
    const task = await this.getTask(taskId, userId);
    if (!task) {
      throw new Error('Task not found or access denied');
    }

    const result = await query(
      `SELECT tc.*,
              u.id as creator_id, u.email as creator_email,
              u.first_name as creator_first_name, u.last_name as creator_last_name,
              u.is_active as creator_is_active, u.created_at as creator_created_at, u.updated_at as creator_updated_at
       FROM task_schema.task_comments tc
       JOIN auth_schema.users u ON tc.created_by = u.id
       WHERE tc.task_id = $1
       ORDER BY tc.created_at ASC`,
      [taskId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      comment: row.comment,
      created_by: row.created_by,
      created_at: row.created_at,
      creator: {
        id: row.creator_id,
        email: row.creator_email,
        first_name: row.creator_first_name,
        last_name: row.creator_last_name,
        is_active: row.creator_is_active,
        created_at: row.creator_created_at,
        updated_at: row.creator_updated_at,
      },
    }));
  }
}
