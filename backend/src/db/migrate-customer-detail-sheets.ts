import { query } from './pool';
import { logger } from '../config/logger';

/**
 * Migration script to add customer detail sheets tables
 * This is safe to run on existing databases
 */
export async function migrateCustomerDetailSheets(): Promise<void> {
  try {
    logger.info('Starting customer detail sheets migration...');

    // Create customer detail sheets table
    await query(`
      CREATE TABLE IF NOT EXISTS crm_schema.customer_detail_sheets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
        detail_data JSONB NOT NULL,
        uploaded_by UUID NOT NULL REFERENCES auth_schema.users(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create customer detail sheet template configuration table
    await query(`
      CREATE TABLE IF NOT EXISTS crm_schema.customer_detail_template (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        field_key VARCHAR(255) UNIQUE NOT NULL,
        field_label VARCHAR(255) NOT NULL,
        is_visible BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_customer_detail_sheets_case_id 
      ON crm_schema.customer_detail_sheets(case_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_customer_detail_template_field_key 
      ON crm_schema.customer_detail_template(field_key)
    `);

    // Create trigger to update updated_at for customer_detail_sheets
    await query(`
      CREATE TRIGGER trigger_update_customer_detail_sheets_updated_at
      BEFORE UPDATE ON crm_schema.customer_detail_sheets
      FOR EACH ROW
      EXECUTE FUNCTION crm_schema.update_updated_at_column()
    `);

    // Create trigger to update updated_at for customer_detail_template
    await query(`
      CREATE TRIGGER trigger_update_customer_detail_template_updated_at
      BEFORE UPDATE ON crm_schema.customer_detail_template
      FOR EACH ROW
      EXECUTE FUNCTION crm_schema.update_updated_at_column()
    `);

    logger.info('Customer detail sheets migration completed successfully');
  } catch (error: any) {
    logger.error('Customer detail sheets migration failed', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateCustomerDetailSheets()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed', error);
      process.exit(1);
    });
}

