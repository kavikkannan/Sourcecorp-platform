import { z } from 'zod';

// Case validators
export const createCaseSchema = z.object({
  body: z.object({
    customer_name: z.string().min(1, 'Customer name is required'),
    customer_email: z.string().email('Invalid email format'),
    customer_phone: z.string().min(1, 'Customer phone is required'),
    loan_type: z.enum(['PERSONAL', 'HOME', 'AUTO', 'BUSINESS', 'EDUCATION'], {
      errorMap: () => ({ message: 'Invalid loan type' }),
    }),
    loan_amount: z.union([
      z.number().positive('Loan amount must be positive'),
      z.string().transform((val) => {
        const num = parseFloat(val);
        if (isNaN(num) || num <= 0) {
          throw new Error('Loan amount must be a positive number');
        }
        return num;
      }),
    ]),
    source_type: z.enum(['DSA', 'DST']).optional().nullable(),
  }),
});

export const caseIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid case ID'),
  }),
});

export const getCasesSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
  }),
});

// Assignment validators
export const assignCaseSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid case ID'),
  }),
  body: z.object({
    assigned_to: z.string().uuid('Invalid user ID'),
  }),
});

// Status validators
export const updateStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid case ID'),
  }),
  body: z.object({
    new_status: z.enum([
      'NEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'PENDING_DOCUMENTS',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
      'DISBURSED',
      'CLOSED',
    ], {
      errorMap: () => ({ message: 'Invalid status' }),
    }),
    remarks: z.string().optional(),
  }),
});

// Document validators
export const uploadDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid case ID'),
  }),
});

export const documentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid case ID'),
    documentId: z.string().uuid('Invalid document ID'),
  }),
});

// Note validators
export const addNoteSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid case ID'),
  }),
  body: z.object({
    note: z.string().min(1, 'Note cannot be empty'),
  }),
});

// Notification/Schedule validators
export const scheduleNotificationSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid case ID'),
  }),
  body: z.object({
    scheduled_for: z.string().uuid('Invalid user ID'),
    message: z.string().optional(),
    scheduled_at: z.string().datetime('Invalid date format'),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
});

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
  body: z.object({
    is_read: z.boolean(),
  }),
});

export const markNotificationCompletionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
  body: z.object({
    completion_status: z.enum(['ONGOING', 'COMPLETED']),
  }),
});

export const getUserNotificationsSchema = z.object({
  query: z.object({
    is_read: z.string().optional(),
    completion_status: z.enum(['ONGOING', 'COMPLETED']).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
  }),
});


