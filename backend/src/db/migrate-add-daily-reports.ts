import { query } from './pool';
import { logger } from '../config/logger';

/**
 * Migration: Add daily_reports table
 * Digitizes WhatsApp opening/closing sales reports.
 */
export async function migrateAddDailyReports(): Promise<void> {
  try {
    logger.info('Starting daily_reports migration');

    const statements = [
      `CREATE TABLE IF NOT EXISTS finance_schema.daily_reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        opening_existing_callbacks INTEGER NOT NULL DEFAULT 0,
        opening_existing_followups INTEGER NOT NULL DEFAULT 0,
        opening_instocks_login INTEGER NOT NULL DEFAULT 0,
        opening_instocks_volume DECIMAL(15, 2) NOT NULL DEFAULT 0,
        opening_instocks_approval DECIMAL(15, 2) NOT NULL DEFAULT 0,
        opening_disbursed DECIMAL(15, 2) NOT NULL DEFAULT 0,
        opening_login_commitment INTEGER NOT NULL DEFAULT 0,
        opening_expected_conversion INTEGER NOT NULL DEFAULT 0,
        opening_documents_pending INTEGER NOT NULL DEFAULT 0,
        opening_login_pending INTEGER NOT NULL DEFAULT 0,
        closing_existing_callbacks INTEGER NOT NULL DEFAULT 0,
        closing_existing_followups INTEGER NOT NULL DEFAULT 0,
        closing_total_logins INTEGER NOT NULL DEFAULT 0,
        closing_total_login_volume DECIMAL(15, 2) NOT NULL DEFAULT 0,
        closing_total_approvals DECIMAL(15, 2) NOT NULL DEFAULT 0,
        closing_total_disbursed DECIMAL(15, 2) NOT NULL DEFAULT 0,
        closing_login_commitment INTEGER NOT NULL DEFAULT 0,
        closing_todays_conversion INTEGER NOT NULL DEFAULT 0,
        closing_todays_callback INTEGER NOT NULL DEFAULT 0,
        closing_documents_pending INTEGER NOT NULL DEFAULT 0,
        closing_login_pending INTEGER NOT NULL DEFAULT 0,
        closing_day_status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (closing_day_status IN ('IN_PROGRESS', 'COMPLETED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, report_date)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id ON finance_schema.daily_reports(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON finance_schema.daily_reports(report_date)`,
      `CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON finance_schema.daily_reports(user_id, report_date)`,
      `CREATE TRIGGER trigger_update_daily_reports_updated_at
        BEFORE UPDATE ON finance_schema.daily_reports
        FOR EACH ROW
        EXECUTE FUNCTION crm_schema.update_updated_at_column()`,
    ];

    for (const statement of statements) {
      try {
        await query(statement);
      } catch (error: any) {
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          throw error;
        }
        logger.warn('Ignored daily_reports migration warning', { message: error.message });
      }
    }

    logger.info('daily_reports migration completed successfully');
  } catch (error: any) {
    logger.error('daily_reports migration failed', error);
    throw error;
  }
}

if (require.main === module) {
  migrateAddDailyReports()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed', error);
      process.exit(1);
    });
}
