import { query } from '../db/pool';

async function migrate() {
  try {
    console.log('Starting obligation sections migration...');

    // Check if section_name column exists
    const columnCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'obligation_fields'
        AND column_name = 'section_name'
      )`
    );

    if (!columnCheck.rows[0].exists) {
      console.log('Adding section_name column to obligation_fields...');
      await query(
        `ALTER TABLE finance_schema.obligation_fields 
         ADD COLUMN section_name VARCHAR(100) DEFAULT 'General'`
      );
      console.log('✓ section_name column added');
    } else {
      console.log('section_name column already exists');
    }

    // Update existing fields to have a default section if null
    await query(
      `UPDATE finance_schema.obligation_fields 
       SET section_name = 'General' 
       WHERE section_name IS NULL`
    );

    // Make section_name NOT NULL after setting defaults
    await query(
      `ALTER TABLE finance_schema.obligation_fields 
       ALTER COLUMN section_name SET NOT NULL`
    );

    console.log('✓ Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
