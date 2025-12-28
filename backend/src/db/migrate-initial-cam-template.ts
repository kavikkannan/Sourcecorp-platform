import { query } from './pool';
import { logger } from '../config/logger';

/**
 * Migration to create initial CAM Template based on real bank format
 * This creates a standard template matching typical bank Credit Appraisal Memo sheets
 */

interface FieldDefinition {
  section_name: string;
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
  is_mandatory: boolean;
  is_user_addable: boolean;
  order_index: number;
  default_value?: string;
  select_options?: string[];
}

const INITIAL_CAM_TEMPLATES = [
  {
    loan_type: 'HOME',
    template_name: 'Standard Bank CAM Template - Home Loan',
    sections: [
      'Applicant Profile',
      'Loan Proposal',
      'Financial Details',
      'Property Details',
      'Risk Assessment',
      'Justification',
      'Conclusion'
    ],
    fields: [
      // Applicant Profile Section
      {
        section_name: 'Applicant Profile',
        field_key: 'applicant_name',
        label: 'Applicant Name',
        field_type: 'text' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 0,
      },
      {
        section_name: 'Applicant Profile',
        field_key: 'applicant_age',
        label: 'Age',
        field_type: 'number' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 1,
      },
      {
        section_name: 'Applicant Profile',
        field_key: 'applicant_occupation',
        label: 'Occupation',
        field_type: 'text' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 2,
      },
      {
        section_name: 'Applicant Profile',
        field_key: 'applicant_experience_years',
        label: 'Years of Experience',
        field_type: 'number' as const,
        is_mandatory: false,
        is_user_addable: false,
        order_index: 3,
      },
      {
        section_name: 'Applicant Profile',
        field_key: 'co_applicant_name',
        label: 'Co-Applicant Name',
        field_type: 'text' as const,
        is_mandatory: false,
        is_user_addable: false,
        order_index: 4,
      },
      
      // Loan Proposal Section
      {
        section_name: 'Loan Proposal',
        field_key: 'loan_amount',
        label: 'Loan Amount Requested',
        field_type: 'currency' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 0,
      },
      {
        section_name: 'Loan Proposal',
        field_key: 'loan_purpose',
        label: 'Loan Purpose',
        field_type: 'select' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 1,
        select_options: ['Purchase', 'Construction', 'Renovation', 'Balance Transfer', 'Top-up', 'Other'],
      },
      {
        section_name: 'Loan Proposal',
        field_key: 'loan_tenure_months',
        label: 'Loan Tenure (Months)',
        field_type: 'number' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 2,
      },
      {
        section_name: 'Loan Proposal',
        field_key: 'interest_rate',
        label: 'Interest Rate (%)',
        field_type: 'number' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 3,
      },
      {
        section_name: 'Loan Proposal',
        field_key: 'emi_amount',
        label: 'Proposed EMI',
        field_type: 'currency' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 4,
      },
      
      // Financial Details Section
      {
        section_name: 'Financial Details',
        field_key: 'monthly_income',
        label: 'Monthly Income',
        field_type: 'currency' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 0,
      },
      {
        section_name: 'Financial Details',
        field_key: 'monthly_obligations',
        label: 'Monthly Obligations',
        field_type: 'currency' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 1,
      },
      {
        section_name: 'Financial Details',
        field_key: 'net_monthly_income',
        label: 'Net Monthly Income',
        field_type: 'currency' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 2,
      },
      {
        section_name: 'Financial Details',
        field_key: 'foir_percentage',
        label: 'FOIR (%)',
        field_type: 'number' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 3,
      },
      {
        section_name: 'Financial Details',
        field_key: 'credit_score',
        label: 'Credit Score',
        field_type: 'number' as const,
        is_mandatory: false,
        is_user_addable: false,
        order_index: 4,
      },
      {
        section_name: 'Financial Details',
        field_key: 'existing_loans',
        label: 'Existing Loans',
        field_type: 'text' as const,
        is_mandatory: false,
        is_user_addable: false,
        order_index: 5,
      },
      
      // Property Details Section
      {
        section_name: 'Property Details',
        field_key: 'property_type',
        label: 'Property Type',
        field_type: 'select' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 0,
        select_options: ['Residential', 'Commercial', 'Plot', 'Under Construction', 'Ready to Move'],
      },
      {
        section_name: 'Property Details',
        field_key: 'property_value',
        label: 'Property Value',
        field_type: 'currency' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 1,
      },
      {
        section_name: 'Property Details',
        field_key: 'ltv_percentage',
        label: 'LTV (%)',
        field_type: 'number' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 2,
      },
      {
        section_name: 'Property Details',
        field_key: 'property_location',
        label: 'Property Location',
        field_type: 'text' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 3,
      },
      
      // Risk Assessment Section
      {
        section_name: 'Risk Assessment',
        field_key: 'risk_level',
        label: 'Risk Level',
        field_type: 'select' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 0,
        select_options: ['Low', 'Medium', 'High'],
      },
      {
        section_name: 'Risk Assessment',
        field_key: 'risk_factors',
        label: 'Risk Factors',
        field_type: 'text' as const,
        is_mandatory: false,
        is_user_addable: false,
        order_index: 1,
      },
      {
        section_name: 'Risk Assessment',
        field_key: 'mitigation_measures',
        label: 'Mitigation Measures',
        field_type: 'text' as const,
        is_mandatory: false,
        is_user_addable: false,
        order_index: 2,
      },
      
      // Justification Section (user-addable fields allowed)
      {
        section_name: 'Justification',
        field_key: 'justification',
        label: 'Justification for Loan Approval',
        field_type: 'text' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 0,
      },
      {
        section_name: 'Justification',
        field_key: 'additional_notes',
        label: 'Additional Notes',
        field_type: 'text' as const,
        is_mandatory: false,
        is_user_addable: true,
        order_index: 1,
      },
      
      // Conclusion Section
      {
        section_name: 'Conclusion',
        field_key: 'recommendation',
        label: 'Recommendation',
        field_type: 'select' as const,
        is_mandatory: true,
        is_user_addable: false,
        order_index: 0,
        select_options: ['Approve', 'Approve with Conditions', 'Reject', 'Refer to Higher Authority'],
      },
      {
        section_name: 'Conclusion',
        field_key: 'approved_amount',
        label: 'Approved Amount',
        field_type: 'currency' as const,
        is_mandatory: false,
        is_user_addable: false,
        order_index: 1,
      },
      {
        section_name: 'Conclusion',
        field_key: 'approval_conditions',
        label: 'Approval Conditions',
        field_type: 'text' as const,
        is_mandatory: false,
        is_user_addable: true,
        order_index: 2,
      },
    ] as FieldDefinition[],
  },
];

export async function migrateInitialCAMTemplate(): Promise<void> {
  try {
    logger.info('Starting initial CAM template migration...');

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

    for (const templateData of INITIAL_CAM_TEMPLATES) {
      // Check if template already exists (case-insensitive match)
      const existingCheck = await query(
        `SELECT id, template_name FROM finance_schema.cam_templates 
         WHERE LOWER(TRIM(loan_type)) = LOWER(TRIM($1)) AND template_name = $2`,
        [templateData.loan_type, templateData.template_name]
      );

      if (existingCheck.rows.length > 0) {
        logger.info(`Template "${templateData.template_name}" for ${templateData.loan_type} already exists with ID: ${existingCheck.rows[0].id}`);
        logger.info('Skipping creation. Use the admin UI to update the template if needed.');
        continue;
      }

      // Create template
      const templateResult = await query(
        `INSERT INTO finance_schema.cam_templates 
         (loan_type, template_name, sections, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          templateData.loan_type,
          templateData.template_name,
          JSON.stringify(templateData.sections),
          true, // Set as active
          adminUserId,
        ]
      );

      const templateId = templateResult.rows[0].id;
      logger.info(`✓ Template created with ID: ${templateId} for ${templateData.loan_type}`);

      // Create fields
      const fields: any[] = [];
      for (const field of templateData.fields) {
        const fieldResult = await query(
          `INSERT INTO finance_schema.cam_fields 
           (template_id, section_name, field_key, label, field_type, is_mandatory, 
            is_user_addable, order_index, default_value, select_options)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            templateId,
            field.section_name,
            field.field_key,
            field.label,
            field.field_type,
            field.is_mandatory,
            field.is_user_addable,
            field.order_index,
            field.default_value || null,
            field.select_options ? JSON.stringify(field.select_options) : null,
          ]
        );

        fields.push(fieldResult.rows[0]);
        logger.info(`  ✓ Field created: ${field.label} (${field.field_key}) in ${field.section_name}`);
      }

      logger.info(`✓ Successfully created CAM Template for ${templateData.loan_type} with ${fields.length} fields`);
      logger.info(`Template Details:`);
      logger.info(`  Name: ${templateData.template_name}`);
      logger.info(`  ID: ${templateId}`);
      logger.info(`  Sections: ${templateData.sections.length}`);
      logger.info(`  Fields: ${fields.length}`);
      logger.info(`  Mandatory Fields: ${templateData.fields.filter(f => f.is_mandatory).length}`);
      logger.info(`  User-Addable Fields: ${templateData.fields.filter(f => f.is_user_addable).length}`);
      logger.info(`  Status: Active`);
    }

  } catch (error: any) {
    logger.error('Error creating initial CAM template:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateInitialCAMTemplate()
    .then(() => {
      logger.info('Initial CAM template migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Initial CAM template migration failed', error);
      process.exit(1);
    });
}

