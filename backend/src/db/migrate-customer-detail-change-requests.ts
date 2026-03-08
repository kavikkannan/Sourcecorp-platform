import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Create customer detail change requests table...');

    // Create the change requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_schema.customer_detail_change_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
        requested_by UUID NOT NULL REFERENCES auth_schema.users(id),
        requested_for UUID NOT NULL REFERENCES auth_schema.users(id),
        requested_changes JSONB NOT NULL, -- Stores the field changes: { field_key: new_value }
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        approval_remarks TEXT,
        approved_by UUID REFERENCES auth_schema.users(id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_detail_change_requests_case_id 
      ON crm_schema.customer_detail_change_requests(case_id);
      
      CREATE INDEX IF NOT EXISTS idx_customer_detail_change_requests_requested_by 
      ON crm_schema.customer_detail_change_requests(requested_by);
      
      CREATE INDEX IF NOT EXISTS idx_customer_detail_change_requests_requested_for 
      ON crm_schema.customer_detail_change_requests(requested_for);
      
      CREATE INDEX IF NOT EXISTS idx_customer_detail_change_requests_status 
      ON crm_schema.customer_detail_change_requests(status);
    `);

    // Ensure the update_updated_at_column function exists
    await pool.query(`
      CREATE OR REPLACE FUNCTION crm_schema.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to update updated_at
    await pool.query(`
      CREATE TRIGGER trigger_update_customer_detail_change_requests_updated_at
      BEFORE UPDATE ON crm_schema.customer_detail_change_requests
      FOR EACH ROW
      EXECUTE FUNCTION crm_schema.update_updated_at_column();
    `);

    logger.info('Migration completed: Customer detail change requests table created successfully.');
  } catch (error: any) {
    if (error.code === '42P07') {
      logger.info('Migration completed: Table already exists.');
    } else {
      logger.error('Migration failed', error);
      throw error;
    }
  }
};

if (typeof require !== 'undefined' && require.main === module) {
  runMigration()
    .then(() => {
      logger.info('Migration completed');
      if (typeof process !== 'undefined') {
        process.exit(0);
      }
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      if (typeof process !== 'undefined') {
        process.exit(1);
      }
    });
}

export default runMigration;

