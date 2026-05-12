import { pool } from './pool';
import { logger } from '../config/logger';

/**
 * Migration script to create recognitions table
 * Stores Monthly Achievers and Best Employee data
 */
const runRecognitionsMigration = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Starting recognitions migration...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_schema.recognitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type VARCHAR(20) NOT NULL CHECK (type IN ('MONTHLY_ACHIEVER', 'BEST_EMPLOYEE')),
        employee_name VARCHAR(255) NOT NULL,
        employee_email VARCHAR(255),
        designation VARCHAR(255),
        month VARCHAR(7) NOT NULL,
        description TEXT,
        image_path VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES auth_schema.users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recognitions_type
      ON admin_schema.recognitions(type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recognitions_active
      ON admin_schema.recognitions(is_active)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recognitions_month
      ON admin_schema.recognitions(month)
    `);

    await client.query('COMMIT');

    logger.info('✓ Recognitions migration completed successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Recognitions migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

runRecognitionsMigration()
  .then(() => {
    logger.info('Recognitions migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Recognitions migration process failed:', error);
    process.exit(1);
  });
