import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Create error_logs table...');

    // Create error_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_schema.error_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES auth_schema.users(id),
        error_message TEXT NOT NULL,
        error_stack TEXT,
        error_code VARCHAR(50),
        path VARCHAR(500),
        method VARCHAR(10),
        request_body JSONB,
        request_query JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON audit_schema.error_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON audit_schema.error_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_error_logs_path ON audit_schema.error_logs(path);
    `);

    logger.info('Migration completed: error_logs table created successfully');
  } catch (error: any) {
    logger.error('Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

export default runMigration;
