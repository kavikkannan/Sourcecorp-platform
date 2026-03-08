import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Link change requests to notifications...');

    // Add change_request_id column to case_notifications table
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'crm_schema' 
          AND table_name = 'case_notifications' 
          AND column_name = 'change_request_id'
        ) THEN
          ALTER TABLE crm_schema.case_notifications
          ADD COLUMN change_request_id UUID REFERENCES crm_schema.customer_detail_change_requests(id) ON DELETE CASCADE;
          
          CREATE INDEX IF NOT EXISTS idx_case_notifications_change_request_id 
          ON crm_schema.case_notifications(change_request_id);
        END IF;
      END $$;
    `);

    logger.info('Migration completed: change_request_id column added to case_notifications');
  } catch (error: any) {
    if (error.code === '42P07') {
      logger.info('Migration completed: Column already exists.');
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

