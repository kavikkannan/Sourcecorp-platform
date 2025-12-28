import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting obligation_items fix migration...');
    
    const migrationPath = path.join(__dirname, 'migrate-fix-obligation-items.sql');
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migration);
    
    logger.info('Obligation items fix migration completed successfully');
    process.exit(0);
  } catch (error: any) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
};

runMigration();

