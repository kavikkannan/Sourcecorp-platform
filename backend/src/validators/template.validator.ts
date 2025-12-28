import { z } from 'zod';

export const createCAMTemplateSchema = z.object({
  body: z.object({
    loan_type: z.string().min(1, 'Loan type is required'),
    template_name: z.string().min(1, 'Template name is required'),
    sections: z.array(z.string()).min(1, 'At least one section is required'),
    fields: z.array(
      z.object({
        section_name: z.string().min(1, 'Section name is required'),
        field_key: z.string().min(1, 'Field key is required'),
        label: z.string().min(1, 'Label is required'),
        field_type: z.enum(['text', 'number', 'currency', 'date', 'select']),
        is_mandatory: z.boolean(),
        is_user_addable: z.boolean(),
        order_index: z.number().int().nonnegative(),
        default_value: z.string().nullable().optional(),
        validation_rules: z.record(z.any()).nullable().optional(),
        select_options: z.array(z.string()).nullable().optional(),
      })
    ).min(1, 'At least one field is required'),
  }),
});

export const updateCAMTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid template ID'),
  }),
  body: z.object({
    template_name: z.string().min(1, 'Template name is required').optional(),
    sections: z.array(z.string()).min(1, 'At least one section is required').optional(),
    is_active: z.boolean().optional(),
    fields: z.array(
      z.object({
        section_name: z.string().min(1, 'Section name is required'),
        field_key: z.string().min(1, 'Field key is required'),
        label: z.string().min(1, 'Label is required'),
        field_type: z.enum(['text', 'number', 'currency', 'date', 'select']),
        is_mandatory: z.boolean(),
        is_user_addable: z.boolean(),
        order_index: z.number().int().nonnegative(),
        default_value: z.string().nullable().optional(),
        validation_rules: z.record(z.any()).nullable().optional(),
        select_options: z.array(z.string()).nullable().optional(),
      })
    ).optional(),
  }),
});

export const getCAMTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid template ID').optional(),
    loanType: z.string().optional(),
  }),
});

export const createObligationTemplateSchema = z.object({
  body: z.object({
    template_name: z.string().min(1, 'Template name is required'),
    sections: z.array(z.string()).default([]), // Sections are optional for obligation templates
    fields: z.array(
      z.object({
        field_key: z.string().min(1, 'Field key is required'),
        label: z.string().min(1, 'Label is required'),
        field_type: z.enum(['text', 'number', 'currency', 'date', 'select']),
        is_mandatory: z.boolean(),
        is_repeatable: z.boolean(),
        order_index: z.number().int().nonnegative(),
        default_value: z.string().nullable().optional(),
        validation_rules: z.record(z.any()).nullable().optional(),
        select_options: z.array(z.string()).nullable().optional(),
      })
    ).min(1, 'At least one field is required'),
  }),
});

export const updateObligationTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid template ID'),
  }),
  body: z.object({
    template_name: z.string().min(1, 'Template name is required').optional(),
    sections: z.array(z.string()).min(1, 'At least one section is required').optional(),
    is_active: z.boolean().optional(),
    fields: z.array(
      z.object({
        field_key: z.string().min(1, 'Field key is required'),
        label: z.string().min(1, 'Label is required'),
        field_type: z.enum(['text', 'number', 'currency', 'date', 'select']),
        is_mandatory: z.boolean(),
        is_repeatable: z.boolean(),
        order_index: z.number().int().nonnegative(),
        default_value: z.string().nullable().optional(),
        validation_rules: z.record(z.any()).nullable().optional(),
        select_options: z.array(z.string()).nullable().optional(),
      })
    ).optional(),
  }),
});

export const getObligationTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid template ID').optional(),
  }),
});

