import { query } from './pool';
import { logger } from '../config/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Phase 4 Permissions Migration
 * Adds all required permissions for Phase 4 features
 */
export async function migratePhase4Permissions(): Promise<void> {
  try {
    logger.info('Starting Phase 4 permissions migration');

    // Read and execute the SQL file
    const sqlPath = path.join(__dirname, 'phase4-permissions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await query(statement);
        } catch (error: any) {
          // Ignore duplicate key errors (ON CONFLICT handles them)
          if (!error.message.includes('duplicate key') && !error.message.includes('already exists')) {
            logger.warn('Statement execution warning:', { statement: statement.substring(0, 100), error: error.message });
          }
        }
      }
    }

    logger.info('Phase 4 permissions migration completed successfully');
  } catch (error: any) {
    logger.error('Phase 4 permissions migration failed', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePhase4Permissions()
    .then(() => {
      logger.info('Permissions migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Permissions migration failed', error);
      process.exit(1);
    });
}

