import { migratePhase4 } from './migrate-phase4-tasks-notes';
import { migratePhase4Permissions } from './migrate-phase4-permissions';
import { logger } from '../config/logger';

/**
 * Run both Phase 4 migrations: schema and permissions
 */
async function runAllMigrations() {
  try {
    logger.info('Starting Phase 4 complete migration (schema + permissions)');
    
    // First run schema migration
    await migratePhase4();
    
    // Then run permissions migration
    await migratePhase4Permissions();
    
    logger.info('Phase 4 complete migration finished successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Phase 4 complete migration failed', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAllMigrations();
}

