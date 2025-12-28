import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Add case notifications/schedules table...');
    
    // Check if table already exists
    const checkTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'crm_schema' 
      AND table_name = 'case_notifications'
    `);

    if (checkTable.rows.length > 0) {
      logger.info('Table case_notifications already exists, skipping migration');
      process.exit(0);
    }

    // Create case_notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_schema.case_notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
        scheduled_for UUID NOT NULL REFERENCES auth_schema.users(id),
        scheduled_by UUID NOT NULL REFERENCES auth_schema.users(id),
        message TEXT,
        scheduled_at TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'CANCELLED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_case_id 
      ON crm_schema.case_notifications(case_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_scheduled_for 
      ON crm_schema.case_notifications(scheduled_for)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_scheduled_by 
      ON crm_schema.case_notifications(scheduled_by)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_scheduled_at 
      ON crm_schema.case_notifications(scheduled_at)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_status 
      ON crm_schema.case_notifications(status)
    `);

    // Create trigger to update updated_at
    await pool.query(`
      CREATE TRIGGER trigger_update_case_notifications_updated_at
      BEFORE UPDATE ON crm_schema.case_notifications
      FOR EACH ROW
      EXECUTE FUNCTION crm_schema.update_updated_at_column()
    `);

    logger.info('Migration completed: case_notifications table created');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
};

runMigration();

