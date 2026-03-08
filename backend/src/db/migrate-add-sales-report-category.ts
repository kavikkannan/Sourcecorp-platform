import { query } from './pool';
import { logger } from '../config/logger';

/**
 * Migration script to add SALES_REPORT category to announcements
 * This updates the check constraint to include SALES_REPORT
 */
export async function migrateAddSalesReportCategory(): Promise<void> {
  try {
    logger.info('Starting migration: Add SALES_REPORT category to announcements...');
    
    // Drop the existing check constraint
    await query(`
      ALTER TABLE admin_schema.announcements
      DROP CONSTRAINT IF EXISTS announcements_category_check
    `);
    
    // Add the updated check constraint with SALES_REPORT
    await query(`
      ALTER TABLE admin_schema.announcements
      ADD CONSTRAINT announcements_category_check 
      CHECK (category IN ('GENERAL', 'BANK_UPDATES', 'SALES_REPORT'))
    `);
    
    logger.info('Migration completed: SALES_REPORT category added to announcements');
  } catch (error: any) {
    logger.error('Migration failed', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAddSalesReportCategory()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed', error);
      process.exit(1);
    });
}

