import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting database migration...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schema);
    
    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
};

runMigration();

