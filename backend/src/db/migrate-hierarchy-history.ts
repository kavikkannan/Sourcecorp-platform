import { pool } from './pool';
import { logger } from '../config/logger';

/**
 * Migration script to add hierarchy history table
 * Tracks manager changes over time for audit and reporting
 */
const runHierarchyHistoryMigration = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting hierarchy history migration...');
    
    // Create hierarchy history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_schema.hierarchy_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subordinate_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
        old_manager_id UUID REFERENCES auth_schema.users(id) ON DELETE SET NULL,
        new_manager_id UUID REFERENCES auth_schema.users(id) ON DELETE SET NULL,
        changed_by UUID REFERENCES auth_schema.users(id) ON DELETE SET NULL,
        change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('ASSIGN', 'REMOVE', 'TRANSFER')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for hierarchy history
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hierarchy_history_subordinate_id 
      ON auth_schema.hierarchy_history(subordinate_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hierarchy_history_old_manager_id 
      ON auth_schema.hierarchy_history(old_manager_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hierarchy_history_new_manager_id 
      ON auth_schema.hierarchy_history(new_manager_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hierarchy_history_created_at 
      ON auth_schema.hierarchy_history(created_at)
    `);
    
    await client.query('COMMIT');
    
    logger.info('✓ Hierarchy history migration completed successfully');
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Hierarchy history migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

runHierarchyHistoryMigration()
  .then(() => {
    logger.info('Hierarchy history migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Hierarchy history migration process failed:', error);
    process.exit(1);
  });
