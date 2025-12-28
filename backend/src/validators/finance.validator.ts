import { z } from 'zod';

export const calculateEligibilitySchema = z.object({
  body: z.object({
    case_id: z.string().uuid('Invalid case ID'),
    monthly_income: z.number().positive('Monthly income must be positive'),
    requested_amount: z.number().positive('Requested amount must be positive'),
  }),
});

export const getEligibilitySchema = z.object({
  params: z.object({
    caseId: z.string().uuid('Invalid case ID'),
  }),
});

export const createObligationSheetSchema = z.object({
  body: z.object({
    case_id: z.string().uuid('Invalid case ID'),
    template_id: z.string().uuid('Invalid template ID').optional(),
    items: z.array(z.record(z.string(), z.any())).min(1, 'At least one obligation item is required'),
    net_income: z.number().positive('Net income must be positive'),
  }),
});

export const updateObligationSheetSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        description: z.string().min(1, 'Description is required'),
        monthly_emi: z.number().nonnegative('Monthly EMI must be non-negative'),
      })
    ).min(1, 'At least one obligation item is required'),
    net_income: z.number().positive('Net income must be positive'),
  }),
  params: z.object({
    sheetId: z.string().uuid('Invalid sheet ID'),
  }),
});

export const getObligationSchema = z.object({
  params: z.object({
    caseId: z.string().uuid('Invalid case ID'),
  }),
});

export const createCAMEntrySchema = z.object({
  body: z.object({
    case_id: z.string().uuid('Invalid case ID'),
    template_id: z.string().uuid('Invalid template ID').optional(),
    loan_type: z.string().optional(), // Used to find template if template_id not provided
    cam_data: z.record(z.string(), z.any()),
    user_added_fields: z.record(z.string(), z.object({
      label: z.string(),
      type: z.string(),
    })).optional(),
  }),
});

export const getCAMSchema = z.object({
  params: z.object({
    caseId: z.string().uuid('Invalid case ID'),
  }),
  query: z.object({
    version: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  }).optional(),
});

export const exportSchema = z.object({
  params: z.object({
    caseId: z.string().uuid('Invalid case ID'),
  }),
  query: z.object({
    format: z.enum(['csv', 'xlsx', 'pdf'], {
      errorMap: () => ({ message: 'Format must be csv, xlsx, or pdf' }),
    }),
  }),
});

