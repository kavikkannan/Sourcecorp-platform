import { z } from 'zod';

// User validators
export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
  body: z.object({
    email: z.string().email('Invalid email format').optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const userIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

// Role validators
export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Role name is required'),
    description: z.string().optional(),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid role ID'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  }),
});

export const roleIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid role ID'),
  }),
});

// Permission validators
export const createPermissionSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Permission name is required'),
    description: z.string().optional(),
  }),
});

export const updatePermissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid permission ID'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  }),
});

export const permissionIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid permission ID'),
  }),
});

// Role-Permission mapping validators
export const assignPermissionToRoleSchema = z.object({
  params: z.object({
    roleId: z.string().uuid('Invalid role ID'),
  }),
  body: z.object({
    permissionId: z.string().uuid('Invalid permission ID'),
  }),
});

export const removePermissionFromRoleSchema = z.object({
  params: z.object({
    roleId: z.string().uuid('Invalid role ID'),
    permissionId: z.string().uuid('Invalid permission ID'),
  }),
});

// User-Role mapping validators
export const assignRoleToUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
  body: z.object({
    roleId: z.string().uuid('Invalid role ID'),
  }),
});

export const removeRoleFromUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user ID'),
    roleId: z.string().uuid('Invalid role ID'),
  }),
});

// Team validators
export const createTeamSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Team name is required'),
    description: z.string().optional(),
  }),
});

export const updateTeamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid team ID'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  }),
});

export const teamIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid team ID'),
  }),
});

export const addTeamMemberSchema = z.object({
  params: z.object({
    teamId: z.string().uuid('Invalid team ID'),
  }),
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});

export const removeTeamMemberSchema = z.object({
  params: z.object({
    teamId: z.string().uuid('Invalid team ID'),
    userId: z.string().uuid('Invalid user ID'),
  }),
});

// Announcement validators
export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
  }),
});

export const updateAnnouncementSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid announcement ID'),
  }),
  body: z.object({
    title: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const announcementIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid announcement ID'),
  }),
});

// ============================================
// HIERARCHY VALIDATORS
// ============================================

export const assignManagerSchema = z.object({
  body: z.object({
    subordinateId: z.string().uuid('Invalid subordinate ID'),
    managerId: z.string().uuid('Invalid manager ID'),
  }),
});

export const removeManagerSchema = z.object({
  body: z.object({
    subordinateId: z.string().uuid('Invalid subordinate ID'),
  }),
});

// ============================================
// TASK VALIDATORS
// ============================================

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    assignedTo: z.string().uuid('Invalid assigned user ID'),
    taskType: z.enum(['PERSONAL', 'COMMON', 'HIERARCHICAL'], {
      errorMap: () => ({ message: 'Task type must be PERSONAL, COMMON, or HIERARCHICAL' }),
    }),
    direction: z.enum(['DOWNWARD', 'UPWARD']).nullable().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    linkedCaseId: z.string().uuid('Invalid case ID').nullable().optional(),
    dueDate: z
      .union([z.string().datetime(), z.null(), z.literal('')])
      .optional()
      .transform((val) => (val === '' ? null : val)),
  }),
});

export const taskIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
  }),
});

export const updateTaskStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
  }),
  body: z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED'], {
      errorMap: () => ({ message: 'Status must be OPEN, IN_PROGRESS, or COMPLETED' }),
    }),
  }),
});

export const addTaskCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
  }),
  body: z.object({
    comment: z.string().min(1, 'Comment is required'),
  }),
});

// ============================================
// NOTE VALIDATORS
// ============================================

export const createNoteSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Content is required'),
    linkedCaseId: z.string().uuid('Invalid case ID').nullable().optional(),
    visibility: z.enum(['PRIVATE', 'CASE']).optional(),
  }),
});

export const noteIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid note ID'),
  }),
});

export const caseIdSchema = z.object({
  params: z.object({
    caseId: z.string().uuid('Invalid case ID'),
  }),
});

