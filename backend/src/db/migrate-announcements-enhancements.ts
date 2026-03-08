import { query } from './pool';
import { logger } from '../config/logger';

/**
 * Migration script to add image_path and category columns to announcements table
 */
const runAnnouncementsMigration = async () => {
  try {
    logger.info('Starting announcements enhancements migration...');
    
    // Add image_path column
    await query(`
      ALTER TABLE admin_schema.announcements
      ADD COLUMN IF NOT EXISTS image_path VARCHAR(500)
    `);
    
    // Add category column (GENERAL or BANK_UPDATES)
    await query(`
      ALTER TABLE admin_schema.announcements
      ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'GENERAL'
      CHECK (category IN ('GENERAL', 'BANK_UPDATES'))
    `);
    
    // Create index on category for faster filtering
    await query(`
      CREATE INDEX IF NOT EXISTS idx_announcements_category 
      ON admin_schema.announcements(category)
    `);
    
    logger.info('Announcements enhancements migration completed successfully');
  } catch (error: any) {
    logger.error('Announcements enhancements migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (typeof require !== 'undefined' && require.main === module) {
  runAnnouncementsMigration()
    .then(() => {
      logger.info('Migration completed');
      if (typeof process !== 'undefined') {
        process.exit(0);
      }
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      if (typeof process !== 'undefined') {
        process.exit(1);
      }
    });
}

export default runAnnouncementsMigration;

