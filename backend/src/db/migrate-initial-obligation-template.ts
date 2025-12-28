import { query } from './pool';
import { logger } from '../config/logger';

/**
 * Migration to create initial Obligation Template based on real bank format
 * This creates a standard template matching typical bank obligation sheets
 */

interface FieldDefinition {
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
  is_mandatory: boolean;
  is_repeatable: boolean;
  order_index: number;
  default_value?: string;
  select_options?: string[];
}

const INITIAL_OBLIGATION_TEMPLATE = {
  template_name: 'Standard Bank Obligation Template',
  sections: ['Obligation Details'],
  fields: [
    // Basic Obligation Information
    {
      field_key: 'obligation_type',
      label: 'Obligation Type',
      field_type: 'select' as const,
      is_mandatory: true,
      is_repeatable: true,
      order_index: 0,
      select_options: ['Home Loan', 'Personal Loan', 'Car Loan', 'Credit Card', 'Other Loan', 'EMI', 'Other'],
    },
    {
      field_key: 'lender_name',
      label: 'Lender/Bank Name',
      field_type: 'text' as const,
      is_mandatory: true,
      is_repeatable: true,
      order_index: 1,
    },
    {
      field_key: 'loan_account_number',
      label: 'Loan Account Number',
      field_type: 'text' as const,
      is_mandatory: false,
      is_repeatable: true,
      order_index: 2,
    },
    
    // Financial Details
    {
      field_key: 'sanctioned_amount',
      label: 'Sanctioned Amount',
      field_type: 'currency' as const,
      is_mandatory: false,
      is_repeatable: true,
      order_index: 3,
    },
    {
      field_key: 'outstanding_balance',
      label: 'Outstanding Balance',
      field_type: 'currency' as const,
      is_mandatory: true,
      is_repeatable: true,
      order_index: 4,
    },
    {
      field_key: 'monthly_emi',
      label: 'Monthly EMI',
      field_type: 'currency' as const,
      is_mandatory: true,
      is_repeatable: true,
      order_index: 5,
    },
    {
      field_key: 'interest_rate',
      label: 'Interest Rate (%)',
      field_type: 'number' as const,
      is_mandatory: false,
      is_repeatable: true,
      order_index: 6,
    },
    
    // Tenure Information
    {
      field_key: 'loan_tenure_months',
      label: 'Loan Tenure (Months)',
      field_type: 'number' as const,
      is_mandatory: false,
      is_repeatable: true,
      order_index: 7,
    },
    {
      field_key: 'loan_start_date',
      label: 'Loan Start Date',
      field_type: 'date' as const,
      is_mandatory: false,
      is_repeatable: true,
      order_index: 8,
    },
    {
      field_key: 'loan_end_date',
      label: 'Loan End Date',
      field_type: 'date' as const,
      is_mandatory: false,
      is_repeatable: true,
      order_index: 9,
    },
    {
      field_key: 'remaining_tenure_months',
      label: 'Remaining Tenure (Months)',
      field_type: 'number' as const,
      is_mandatory: false,
      is_repeatable: true,
      order_index: 10,
    },
    
    // Additional Details
    {
      field_key: 'co_applicant_name',
      label: 'Co-Applicant Name',
      field_type: 'text' as const,
      is_mandatory: false,
      is_repeatable: true,
      order_index: 11,
    },
    {
      field_key: 'remarks',
      label: 'Remarks',
      field_type: 'text' as const,
      is_mandatory: false,
      is_repeatable: true,
      order_index: 12,
    },
  ] as FieldDefinition[],
};

export async function migrateInitialObligationTemplate(): Promise<void> {
  try {
    logger.info('Starting initial obligation template migration...');

    // Get the first admin user, or any active user if no admin exists
    let adminResult = await query(
      `SELECT u.id 
       FROM auth_schema.users u
       JOIN auth_schema.user_roles ur ON u.id = ur.user_id
       JOIN auth_schema.roles r ON ur.role_id = r.id
       WHERE r.name = 'admin' AND u.is_active = true
       LIMIT 1`
    );

    // If no admin user, try to get any active user
    if (adminResult.rows.length === 0) {
      logger.warn('No admin user found, trying to get any active user...');
      adminResult = await query(
        `SELECT id FROM auth_schema.users WHERE is_active = true LIMIT 1`
      );
    }

    if (adminResult.rows.length === 0) {
      throw new Error('No active user found. Please create a user first.');
    }

    const adminUserId = adminResult.rows[0].id;
    logger.info(`Using admin user ID: ${adminUserId}`);

    // Check if template already exists
    const existingCheck = await query(
      `SELECT id, template_name FROM finance_schema.obligation_templates 
       WHERE template_name = $1`,
      [INITIAL_OBLIGATION_TEMPLATE.template_name]
    );

    if (existingCheck.rows.length > 0) {
      logger.info(`Template "${INITIAL_OBLIGATION_TEMPLATE.template_name}" already exists with ID: ${existingCheck.rows[0].id}`);
      logger.info('Skipping creation. Use the admin UI to update the template if needed.');
      return;
    }

    // Create template
    const templateResult = await query(
      `INSERT INTO finance_schema.obligation_templates 
       (template_name, sections, is_active, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        INITIAL_OBLIGATION_TEMPLATE.template_name,
        JSON.stringify(INITIAL_OBLIGATION_TEMPLATE.sections),
        true, // Set as active
        adminUserId,
      ]
    );

    const templateId = templateResult.rows[0].id;
    logger.info(`✓ Template created with ID: ${templateId}`);

    // Create fields
    const fields: any[] = [];
    for (const field of INITIAL_OBLIGATION_TEMPLATE.fields) {
      const fieldResult = await query(
        `INSERT INTO finance_schema.obligation_fields 
         (template_id, field_key, label, field_type, is_mandatory, 
          is_repeatable, order_index, default_value, select_options)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          templateId,
          field.field_key,
          field.label,
          field.field_type,
          field.is_mandatory,
          field.is_repeatable,
          field.order_index,
          field.default_value || null,
          field.select_options ? JSON.stringify(field.select_options) : null,
        ]
      );

      fields.push(fieldResult.rows[0]);
      logger.info(`  ✓ Field created: ${field.label} (${field.field_key})`);
    }

    logger.info(`✓ Successfully created Obligation Template with ${fields.length} fields`);
    logger.info(`Template Details:`);
    logger.info(`  Name: ${INITIAL_OBLIGATION_TEMPLATE.template_name}`);
    logger.info(`  ID: ${templateId}`);
    logger.info(`  Fields: ${fields.length}`);
    logger.info(`  Mandatory Fields: ${INITIAL_OBLIGATION_TEMPLATE.fields.filter(f => f.is_mandatory).length}`);
    logger.info(`  Status: Active`);

  } catch (error: any) {
    logger.error('Error creating initial obligation template:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateInitialObligationTemplate()
    .then(() => {
      logger.info('Initial obligation template migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Initial obligation template migration failed', error);
      process.exit(1);
    });
}

