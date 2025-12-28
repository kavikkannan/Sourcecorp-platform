/**
 * Script to create the initial Obligation Template based on real bank format
 * This script manually creates a template matching the OBLIGATION WORKING SHEET structure
 * 
 * Run with: ts-node scripts/create-initial-obligation-template.ts
 */

// Import path adjusted for running from scripts directory
import { query } from './backend/src/db/pool';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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

// Based on typical bank obligation sheets, defining standard fields
const INITIAL_OBLIGATION_TEMPLATE = {
  template_name: 'Standard Bank Obligation Template',
  sections: ['Obligation Details'], // Sections are optional for obligation templates
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

async function createInitialTemplate(adminUserId: string) {
  try {
    console.log('Creating initial Obligation Template...');
    
    // Check if template already exists
    const existingCheck = await query(
      `SELECT id, template_name FROM finance_schema.obligation_templates 
       WHERE template_name = $1`,
      [INITIAL_OBLIGATION_TEMPLATE.template_name]
    );

    if (existingCheck.rows.length > 0) {
      console.log(`Template "${INITIAL_OBLIGATION_TEMPLATE.template_name}" already exists with ID: ${existingCheck.rows[0].id}`);
      console.log('Skipping creation. Use the admin UI to update the template if needed.');
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
    console.log(`✓ Template created with ID: ${templateId}`);

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
      console.log(`  ✓ Field created: ${field.label} (${field.field_key})`);
    }

    console.log(`\n✓ Successfully created Obligation Template with ${fields.length} fields`);
    console.log(`\nTemplate Details:`);
    console.log(`  Name: ${INITIAL_OBLIGATION_TEMPLATE.template_name}`);
    console.log(`  ID: ${templateId}`);
    console.log(`  Fields: ${fields.length}`);
    console.log(`  Mandatory Fields: ${INITIAL_OBLIGATION_TEMPLATE.fields.filter(f => f.is_mandatory).length}`);
    console.log(`  Status: Active`);
    
  } catch (error: any) {
    console.error('Error creating template:', error);
    throw error;
  }
}

async function getAdminUserId(): Promise<string> {
  // Get the first admin user
  const result = await query(
    `SELECT u.id 
     FROM auth_schema.users u
     JOIN auth_schema.user_roles ur ON u.id = ur.user_id
     JOIN auth_schema.roles r ON ur.role_id = r.id
     WHERE r.name = 'admin' AND u.is_active = true
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    throw new Error('No active admin user found. Please create an admin user first.');
  }

  return result.rows[0].id;
}

async function main() {
  try {
    console.log('Initial Obligation Template Creator');
    console.log('==================================\n');

    const adminUserId = await getAdminUserId();
    console.log(`Using admin user ID: ${adminUserId}\n`);

    await createInitialTemplate(adminUserId);

    console.log('\n✓ Template creation completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

