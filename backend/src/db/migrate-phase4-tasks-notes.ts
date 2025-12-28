import { query } from './pool';
import { logger } from '../config/logger';

/**
 * Phase 4 Migration: Tasks, Notes & Hierarchical Productivity
 * 
 * This migration:
 * 1. Extends task_schema.tasks table with task_type, priority, linked_case_id
 * 2. Creates task_schema.task_comments table
 * 3. Creates note_schema with notes table
 * 4. Updates existing tasks to have default task_type='HIERARCHICAL'
 */

export async function migratePhase4(): Promise<void> {
  try {
    logger.info('Starting Phase 4 migration: Tasks, Notes & Hierarchical Productivity');

    // Create note_schema
    await query('CREATE SCHEMA IF NOT EXISTS note_schema');

    // ============================================
    // EXTEND TASKS TABLE
    // ============================================
    
    // Add task_type column (if not exists)
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'task_schema' 
          AND table_name = 'tasks' 
          AND column_name = 'task_type'
        ) THEN
          ALTER TABLE task_schema.tasks 
          ADD COLUMN task_type VARCHAR(20) NOT NULL DEFAULT 'HIERARCHICAL' 
          CHECK (task_type IN ('PERSONAL', 'COMMON', 'HIERARCHICAL'));
        END IF;
      END $$;
    `);

    // Add priority column (if not exists)
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'task_schema' 
          AND table_name = 'tasks' 
          AND column_name = 'priority'
        ) THEN
          ALTER TABLE task_schema.tasks 
          ADD COLUMN priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' 
          CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'));
        END IF;
      END $$;
    `);

    // Add linked_case_id column (if not exists)
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'task_schema' 
          AND table_name = 'tasks' 
          AND column_name = 'linked_case_id'
        ) THEN
          ALTER TABLE task_schema.tasks 
          ADD COLUMN linked_case_id UUID REFERENCES crm_schema.cases(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Make direction nullable for PERSONAL and COMMON tasks
    await query(`
      DO $$ 
      BEGIN
        -- Drop existing constraint if it exists
        ALTER TABLE task_schema.tasks DROP CONSTRAINT IF EXISTS tasks_direction_check;
        
        -- Add new constraint that allows NULL for PERSONAL and COMMON tasks
        ALTER TABLE task_schema.tasks 
        ADD CONSTRAINT tasks_direction_check 
        CHECK (
          (task_type = 'HIERARCHICAL' AND direction IN ('DOWNWARD', 'UPWARD')) OR
          (task_type IN ('PERSONAL', 'COMMON') AND direction IS NULL)
        );
      END $$;
    `);

    // Update existing tasks to have HIERARCHICAL type
    await query(`
      UPDATE task_schema.tasks 
      SET task_type = 'HIERARCHICAL' 
      WHERE task_type IS NULL OR task_type = '';
    `);

    // Create index for task_type
    await query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_task_type 
      ON task_schema.tasks(task_type);
    `);

    // Create index for priority
    await query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_priority 
      ON task_schema.tasks(priority);
    `);

    // Create index for linked_case_id
    await query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_linked_case_id 
      ON task_schema.tasks(linked_case_id);
    `);

    // ============================================
    // TASK COMMENTS TABLE
    // ============================================
    
    await query(`
      CREATE TABLE IF NOT EXISTS task_schema.task_comments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        task_id UUID NOT NULL REFERENCES task_schema.tasks(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        created_by UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for task_comments
    await query(`
      CREATE INDEX IF NOT EXISTS idx_task_comments_task_id 
      ON task_schema.task_comments(task_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_task_comments_created_by 
      ON task_schema.task_comments(created_by);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_task_comments_created_at 
      ON task_schema.task_comments(created_at);
    `);

    // ============================================
    // NOTES TABLE
    // ============================================
    
    await query(`
      CREATE TABLE IF NOT EXISTS note_schema.notes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        content TEXT NOT NULL,
        created_by UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
        linked_case_id UUID REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
        visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE' 
          CHECK (visibility IN ('PRIVATE', 'CASE')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for notes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_notes_created_by 
      ON note_schema.notes(created_by);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_notes_linked_case_id 
      ON note_schema.notes(linked_case_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_notes_visibility 
      ON note_schema.notes(visibility);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_notes_created_at 
      ON note_schema.notes(created_at);
    `);

    // ============================================
    // UPDATE TASK VALIDATION FUNCTION
    // ============================================
    
    // Drop and recreate the validation function to handle new task types
    await query(`
      DROP FUNCTION IF EXISTS task_schema.validate_task_assignment() CASCADE;
    `);

    await query(`
      CREATE OR REPLACE FUNCTION task_schema.validate_task_assignment()
      RETURNS TRIGGER AS $$
      DECLARE
        is_subordinate BOOLEAN;
        is_manager BOOLEAN;
      BEGIN
        -- Only validate hierarchy for HIERARCHICAL tasks
        IF NEW.task_type = 'HIERARCHICAL' THEN
          -- For DOWNWARD tasks: assigned_to must be a subordinate of assigned_by
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
          
          -- For UPWARD tasks: assigned_to must be the manager of assigned_by
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
        END IF;
        
        -- For PERSONAL tasks: assigned_to must equal assigned_by
        IF NEW.task_type = 'PERSONAL' THEN
          IF NEW.assigned_to != NEW.assigned_by THEN
            RAISE EXCEPTION 'PERSONAL tasks must be assigned to the creator';
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Recreate trigger
    await query(`
      DROP TRIGGER IF EXISTS trigger_validate_task_assignment ON task_schema.tasks;
    `);

    await query(`
      CREATE TRIGGER trigger_validate_task_assignment
        BEFORE INSERT OR UPDATE ON task_schema.tasks
        FOR EACH ROW
        EXECUTE FUNCTION task_schema.validate_task_assignment();
    `);

    logger.info('Phase 4 migration completed successfully');
  } catch (error: any) {
    logger.error('Phase 4 migration failed', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePhase4()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed', error);
      process.exit(1);
    });
}

