import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Add document_id to case_notes and case_notifications...');
    
    // Add document_id column to case_notes table
    const checkNotesColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'crm_schema' 
      AND table_name = 'case_notes' 
      AND column_name = 'document_id'
    `);

    if (checkNotesColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE crm_schema.case_notes
        ADD COLUMN document_id UUID REFERENCES crm_schema.documents(id) ON DELETE SET NULL
      `);
      logger.info('Added document_id column to case_notes table');
    } else {
      logger.info('document_id column already exists in case_notes table');
    }

    // Add document_id column to case_notifications table
    const checkNotificationsColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'crm_schema' 
      AND table_name = 'case_notifications' 
      AND column_name = 'document_id'
    `);

    if (checkNotificationsColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE crm_schema.case_notifications
        ADD COLUMN document_id UUID REFERENCES crm_schema.documents(id) ON DELETE SET NULL
      `);
      logger.info('Added document_id column to case_notifications table');
    } else {
      logger.info('document_id column already exists in case_notifications table');
    }

    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notes_document_id 
      ON crm_schema.case_notes(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_document_id 
      ON crm_schema.case_notifications(document_id)
    `);

    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
};

runMigration();

