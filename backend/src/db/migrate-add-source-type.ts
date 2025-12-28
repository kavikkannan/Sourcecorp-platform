import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Add source_type to CRM cases...');
    
    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'crm_schema' 
      AND table_name = 'cases' 
      AND column_name = 'source_type'
    `);

    if (checkColumn.rows.length > 0) {
      logger.info('Column source_type already exists, skipping migration');
      process.exit(0);
    }

    // Add source_type column
    await pool.query(`
      ALTER TABLE crm_schema.cases 
      ADD COLUMN source_type VARCHAR(10) CHECK (source_type IN ('DSA', 'DST'))
    `);

    logger.info('Migration completed: source_type column added to crm_schema.cases');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
};

runMigration();

