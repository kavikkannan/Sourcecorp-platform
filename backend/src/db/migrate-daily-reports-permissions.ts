import { query } from './pool';
import { logger } from '../config/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration: Add daily reports permissions
 */
export async function migrateDailyReportsPermissions(): Promise<void> {
  try {
    logger.info('Starting daily reports permissions migration');

    const sqlPath = path.join(__dirname, 'daily-reports-permissions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await query(statement);
        } catch (error: any) {
          if (!error.message.includes('duplicate key') && !error.message.includes('already exists')) {
            logger.warn('Statement execution warning:', { statement: statement.substring(0, 100), error: error.message });
          }
        }
      }
    }

    logger.info('Daily reports permissions migration completed successfully');
  } catch (error: any) {
    logger.error('Daily reports permissions migration failed', error);
    throw error;
  }
}

if (require.main === module) {
  migrateDailyReportsPermissions()
    .then(() => {
      logger.info('Permissions migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Permissions migration failed', error);
      process.exit(1);
    });
}
