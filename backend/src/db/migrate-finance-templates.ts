import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting finance templates migration...');
    
    const migrationPath = path.join(__dirname, 'migrations', '003_finance_templates.sql');
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migration);
    
    logger.info('Finance templates migration completed successfully');
    process.exit(0);
  } catch (error: any) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
};

runMigration();

