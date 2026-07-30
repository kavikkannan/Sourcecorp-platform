import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Add notification enhancements...');

    // Ensure base case_notifications table exists with all current columns.
    // This migration is idempotent: IF NOT EXISTS is used everywhere.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_schema.case_notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
        scheduled_for UUID NOT NULL REFERENCES auth_schema.users(id),
        scheduled_by UUID NOT NULL REFERENCES auth_schema.users(id),
        message TEXT,
        scheduled_at TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'CANCELLED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add columns that were missing from the original migration but used by the app.
    await pool.query(`
      ALTER TABLE crm_schema.case_notifications
        ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS completion_status VARCHAR(20) NOT NULL DEFAULT 'ONGOING',
        ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'CASE_REMINDER',
        ADD COLUMN IF NOT EXISTS title VARCHAR(255),
        ADD COLUMN IF NOT EXISTS action_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
    `);

    // Indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_case_id
      ON crm_schema.case_notifications(case_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_scheduled_for
      ON crm_schema.case_notifications(scheduled_for)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_scheduled_by
      ON crm_schema.case_notifications(scheduled_by)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_scheduled_at
      ON crm_schema.case_notifications(scheduled_at)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_status
      ON crm_schema.case_notifications(status)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_is_read
      ON crm_schema.case_notifications(is_read)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_completion
      ON crm_schema.case_notifications(completion_status)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_case_notifications_type
      ON crm_schema.case_notifications(type)
    `);

    // Trigger for updated_at (idempotent using OR REPLACE)
    await pool.query(`
      CREATE OR REPLACE FUNCTION crm_schema.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_update_case_notifications_updated_at
      ON crm_schema.case_notifications
    `);
    await pool.query(`
      CREATE TRIGGER trigger_update_case_notifications_updated_at
      BEFORE UPDATE ON crm_schema.case_notifications
      FOR EACH ROW
      EXECUTE FUNCTION crm_schema.update_updated_at_column()
    `);

    // Notification preferences (Phase 4)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_schema.notification_preferences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) NOT NULL,
        in_app BOOLEAN NOT NULL DEFAULT true,
        email BOOLEAN NOT NULL DEFAULT false,
        push BOOLEAN NOT NULL DEFAULT false,
        digest_mode VARCHAR(20) NOT NULL DEFAULT 'IMMEDIATE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, notification_type)
      )
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_update_notification_preferences_updated_at
      ON crm_schema.notification_preferences
    `);
    await pool.query(`
      CREATE TRIGGER trigger_update_notification_preferences_updated_at
      BEFORE UPDATE ON crm_schema.notification_preferences
      FOR EACH ROW
      EXECUTE FUNCTION crm_schema.update_updated_at_column()
    `);

    logger.info('Migration completed: notification enhancements');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
};

runMigration();
