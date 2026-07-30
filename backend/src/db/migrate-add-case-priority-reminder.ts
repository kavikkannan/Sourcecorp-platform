import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Add case priority and reminder date...');

    await pool.query(`
      ALTER TABLE crm_schema.cases
        ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
        ADD COLUMN IF NOT EXISTS reminder_date TIMESTAMP
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cases_priority
      ON crm_schema.cases(priority)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cases_reminder_date
      ON crm_schema.cases(reminder_date)
    `);

    logger.info('Migration completed: case priority and reminder date');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
};

runMigration();
