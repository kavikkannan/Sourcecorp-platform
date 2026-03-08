import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Update case number format to include loan type prefix and user ID...');

    // First, update the function to generate case numbers with loan type prefix and user ID
    await pool.query(`
      CREATE OR REPLACE FUNCTION crm_schema.generate_case_number(loan_type_val VARCHAR, user_id_val UUID)
      RETURNS TEXT AS $$
      DECLARE
        new_number TEXT;
        counter INTEGER;
        prefix TEXT;
        user_id_short TEXT;
      BEGIN
        -- Map loan type to prefix
        CASE loan_type_val
          WHEN 'PERSONAL' THEN prefix := 'PL';
          WHEN 'BUSINESS' THEN prefix := 'BL';
          WHEN 'EDUCATION' THEN prefix := 'EL';
          WHEN 'HOME' THEN prefix := 'HL';
          WHEN 'AUTO' THEN prefix := 'AL';
          ELSE prefix := 'CASE';
        END CASE;

        -- Get short user ID (first 8 characters)
        user_id_short := SUBSTRING(user_id_val::TEXT, 1, 8);

        -- Count cases with same prefix and date
        SELECT COUNT(*) INTO counter 
        FROM crm_schema.cases 
        WHERE case_number LIKE prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || user_id_short || '-%';

        -- Generate new case number: PREFIX-YYYYMMDD-USERID-XXXXX
        new_number := prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || user_id_short || '-' || LPAD((counter + 1)::TEXT, 5, '0');
        
        RETURN new_number;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Update the trigger function to pass loan_type and created_by to generate_case_number
    await pool.query(`
      CREATE OR REPLACE FUNCTION crm_schema.set_case_number()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
          NEW.case_number := crm_schema.generate_case_number(NEW.loan_type, NEW.created_by);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    logger.info('Updated case number generation function and trigger.');

    // Now update existing cases
    logger.info('Updating existing case numbers...');
    
    // First, create a temporary table with the new case numbers
    await pool.query(`
      CREATE TEMP TABLE temp_case_numbers AS
      SELECT 
        id,
        CASE loan_type
          WHEN 'PERSONAL' THEN 'PL'
          WHEN 'BUSINESS' THEN 'BL'
          WHEN 'EDUCATION' THEN 'EL'
          WHEN 'HOME' THEN 'HL'
          WHEN 'AUTO' THEN 'AL'
          ELSE 'CASE'
        END || '-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || SUBSTRING(created_by::TEXT, 1, 8) || '-' || LPAD(
          ROW_NUMBER() OVER (
            PARTITION BY 
              CASE loan_type
                WHEN 'PERSONAL' THEN 'PL'
                WHEN 'BUSINESS' THEN 'BL'
                WHEN 'EDUCATION' THEN 'EL'
                WHEN 'HOME' THEN 'HL'
                WHEN 'AUTO' THEN 'AL'
                ELSE 'CASE'
              END,
              TO_CHAR(created_at, 'YYYYMMDD'),
              SUBSTRING(created_by::TEXT, 1, 8)
            ORDER BY created_at, id
          )::TEXT,
          5,
          '0'
        ) as new_case_number
      FROM crm_schema.cases
      WHERE case_number LIKE 'CASE-%';
    `);
    
    // Now update the cases using the temporary table
    const updateResult = await pool.query(`
      UPDATE crm_schema.cases c
      SET case_number = tcn.new_case_number
      FROM temp_case_numbers tcn
      WHERE c.id = tcn.id
      RETURNING c.id, c.case_number;
    `);
    
    // Drop the temporary table
    await pool.query(`DROP TABLE temp_case_numbers;`);

    if (updateResult.rows.length > 0) {
      logger.info(`Updated ${updateResult.rows.length} existing case number(s).`);
    } else {
      logger.info('No existing cases to update (or all cases already use new format).');
    }

    logger.info('Migration completed: Case number format updated successfully.');
  } catch (error) {
    logger.error('Migration failed', error);
    throw error;
  }
};

if (typeof require !== 'undefined' && require.main === module) {
  runMigration()
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

export default runMigration;

