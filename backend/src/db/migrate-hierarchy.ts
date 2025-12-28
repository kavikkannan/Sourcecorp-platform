import { pool } from './pool';
import { logger } from '../config/logger';

/**
 * Migration script to add hierarchy and task tables
 * This is safe to run on existing databases
 */
const runHierarchyMigration = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting hierarchy and task migration...');
    
    // Create task_schema if it doesn't exist
    await client.query('CREATE SCHEMA IF NOT EXISTS task_schema');
    
    // Create user_hierarchy table
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_schema.user_hierarchy (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        manager_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
        subordinate_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(subordinate_id),
        CONSTRAINT check_no_self_reference CHECK (manager_id != subordinate_id)
      )
    `);
    
    // Create indexes for hierarchy
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_hierarchy_manager_id 
      ON auth_schema.user_hierarchy(manager_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_hierarchy_subordinate_id 
      ON auth_schema.user_hierarchy(subordinate_id)
    `);
    
    // Create function to check for circular hierarchy
    await client.query(`
      CREATE OR REPLACE FUNCTION auth_schema.check_hierarchy_cycle()
      RETURNS TRIGGER AS $$
      DECLARE
        current_manager UUID;
        visited UUID[] := ARRAY[NEW.subordinate_id];
      BEGIN
        current_manager := NEW.manager_id;
        
        WHILE current_manager IS NOT NULL LOOP
          IF current_manager = ANY(visited) THEN
            RAISE EXCEPTION 'Circular hierarchy detected: cannot create cycle in reporting structure';
          END IF;
          
          visited := array_append(visited, current_manager);
          
          SELECT manager_id INTO current_manager
          FROM auth_schema.user_hierarchy
          WHERE subordinate_id = current_manager;
        END LOOP;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    // Create trigger to prevent circular hierarchy
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_check_hierarchy_cycle ON auth_schema.user_hierarchy
    `);
    
    await client.query(`
      CREATE TRIGGER trigger_check_hierarchy_cycle
        BEFORE INSERT OR UPDATE ON auth_schema.user_hierarchy
        FOR EACH ROW
        EXECUTE FUNCTION auth_schema.check_hierarchy_cycle()
    `);
    
    // Create tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_schema.tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
        assigned_by UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
        direction VARCHAR(20) NOT NULL CHECK (direction IN ('DOWNWARD', 'UPWARD')),
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED')),
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create function to validate task assignment
    await client.query(`
      CREATE OR REPLACE FUNCTION task_schema.validate_task_assignment()
      RETURNS TRIGGER AS $$
      DECLARE
        is_subordinate BOOLEAN;
        is_manager BOOLEAN;
      BEGIN
        IF NEW.direction = 'DOWNWARD' THEN
          SELECT EXISTS(
            SELECT 1 FROM auth_schema.user_hierarchy
            WHERE manager_id = NEW.assigned_by
            AND subordinate_id = NEW.assigned_to
          ) INTO is_subordinate;
          
          IF NOT is_subordinate THEN
            RAISE EXCEPTION 'DOWNWARD tasks can only be assigned to direct subordinates';
          END IF;
        END IF;
        
        IF NEW.direction = 'UPWARD' THEN
          SELECT EXISTS(
            SELECT 1 FROM auth_schema.user_hierarchy
            WHERE manager_id = NEW.assigned_to
            AND subordinate_id = NEW.assigned_by
          ) INTO is_manager;
          
          IF NOT is_manager THEN
            RAISE EXCEPTION 'UPWARD tasks can only be raised to direct manager';
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    // Create trigger to validate task assignment
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_validate_task_assignment ON task_schema.tasks
    `);
    
    await client.query(`
      CREATE TRIGGER trigger_validate_task_assignment
        BEFORE INSERT OR UPDATE ON task_schema.tasks
        FOR EACH ROW
        EXECUTE FUNCTION task_schema.validate_task_assignment()
    `);
    
    // Create indexes for tasks
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON task_schema.tasks(assigned_to)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON task_schema.tasks(assigned_by)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON task_schema.tasks(status)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_direction ON task_schema.tasks(direction)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON task_schema.tasks(created_at)
    `);
    
    // Create trigger to update tasks updated_at timestamp
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_tasks_updated_at ON task_schema.tasks
    `);
    
    await client.query(`
      CREATE TRIGGER trigger_update_tasks_updated_at
        BEFORE UPDATE ON task_schema.tasks
        FOR EACH ROW
        EXECUTE FUNCTION crm_schema.update_updated_at_column()
    `);
    
    await client.query('COMMIT');
    
    logger.info('✓ Hierarchy and task migration completed successfully');
    
    // Check if admin user exists
    const adminCheck = await client.query(`
      SELECT COUNT(*) as count FROM auth_schema.users WHERE email LIKE '%admin%'
    `);
    
    if (parseInt(adminCheck.rows[0].count) === 0) {
      logger.warn('⚠ No admin user found. Please create an admin user using:');
      logger.warn('   bash scripts/setup-admin.sh');
      logger.warn('   OR');
      logger.warn('   docker-compose exec backend npm run setup-admin');
    } else {
      logger.info('✓ Admin user(s) found in database');
    }
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

runHierarchyMigration()
  .then(() => {
    logger.info('Migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration process failed:', error);
    process.exit(1);
  });

