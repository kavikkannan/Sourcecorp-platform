-- Migration: Add template-driven structure to CAM and Obligation sheets
-- This migration updates existing tables and adds new template tables

-- Step 0: Ensure new template tables exist (they should be in schema.sql, but create if missing)
CREATE TABLE IF NOT EXISTS finance_schema.cam_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_type VARCHAR(100) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    sections JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(loan_type, template_name)
);

CREATE TABLE IF NOT EXISTS finance_schema.cam_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES finance_schema.cam_templates(id) ON DELETE CASCADE,
    section_name VARCHAR(255) NOT NULL,
    field_key VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'currency', 'date', 'select')),
    is_mandatory BOOLEAN DEFAULT false,
    is_user_addable BOOLEAN DEFAULT false,
    order_index INTEGER NOT NULL DEFAULT 0,
    default_value TEXT,
    validation_rules JSONB,
    select_options JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, section_name, field_key)
);

CREATE TABLE IF NOT EXISTS finance_schema.obligation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(255) NOT NULL UNIQUE,
    sections JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_schema.obligation_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES finance_schema.obligation_templates(id) ON DELETE CASCADE,
    field_key VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'currency', 'date', 'select')),
    is_mandatory BOOLEAN DEFAULT false,
    is_repeatable BOOLEAN DEFAULT true,
    order_index INTEGER NOT NULL DEFAULT 0,
    default_value TEXT,
    validation_rules JSONB,
    select_options JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, field_key)
);

-- Step 1: Update cam_templates structure if needed (MUST RUN FIRST)
DO $$
BEGIN
    -- Add template_name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_templates' 
        AND column_name = 'template_name'
    ) THEN
        ALTER TABLE finance_schema.cam_templates 
        ADD COLUMN template_name VARCHAR(255) DEFAULT 'Default Template';
        
        -- Update existing rows
        UPDATE finance_schema.cam_templates
        SET template_name = 'Template for ' || loan_type
        WHERE template_name = 'Default Template';
    END IF;

    -- Make template_definition nullable if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_templates' 
        AND column_name = 'template_definition'
    ) THEN
        -- Check if it's NOT NULL and make it nullable
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'finance_schema' 
            AND table_name = 'cam_templates' 
            AND column_name = 'template_definition'
            AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE finance_schema.cam_templates 
            ALTER COLUMN template_definition DROP NOT NULL;
        END IF;
    END IF;

    -- Add sections column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_templates' 
        AND column_name = 'sections'
    ) THEN
        ALTER TABLE finance_schema.cam_templates 
        ADD COLUMN sections JSONB;
        
        -- Migrate template_definition to sections if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'finance_schema' 
            AND table_name = 'cam_templates' 
            AND column_name = 'template_definition'
        ) THEN
            UPDATE finance_schema.cam_templates
            SET sections = template_definition
            WHERE sections IS NULL AND template_definition IS NOT NULL;
        END IF;
    END IF;
    
    -- Make sections NOT NULL after migration
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_templates' 
        AND column_name = 'sections'
        AND is_nullable = 'YES'
    ) THEN
        -- First set default for any NULL values
        UPDATE finance_schema.cam_templates
        SET sections = '[]'::jsonb
        WHERE sections IS NULL;
        
        -- Then make it NOT NULL
        ALTER TABLE finance_schema.cam_templates 
        ALTER COLUMN sections SET NOT NULL;
    END IF;

    -- Add is_active if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_templates' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE finance_schema.cam_templates 
        ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    -- Add updated_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_templates' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE finance_schema.cam_templates 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Step 2: Add new columns to existing tables (runs after Step 1)
DO $$ 
BEGIN
    -- Add template_snapshot to cam_entries if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_entries' 
        AND column_name = 'template_snapshot'
    ) THEN
        ALTER TABLE finance_schema.cam_entries 
        ADD COLUMN template_snapshot JSONB;
        
        -- Note: Data migration for template_snapshot will be handled separately
        -- if needed, as it requires the cam_templates table to have all new columns
    END IF;

    -- Add user_added_fields to cam_entries if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_entries' 
        AND column_name = 'user_added_fields'
    ) THEN
        ALTER TABLE finance_schema.cam_entries 
        ADD COLUMN user_added_fields JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add template_id and template_snapshot to obligation_sheets if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'obligation_sheets' 
        AND column_name = 'template_id'
    ) THEN
        ALTER TABLE finance_schema.obligation_sheets 
        ADD COLUMN template_id UUID REFERENCES finance_schema.obligation_templates(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'obligation_sheets' 
        AND column_name = 'template_snapshot'
    ) THEN
        ALTER TABLE finance_schema.obligation_sheets 
        ADD COLUMN template_snapshot JSONB;
    END IF;

    -- Migrate obligation_items: convert description and monthly_emi to item_data JSONB
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'obligation_items'
        AND column_name = 'description'
    ) THEN
        -- Add item_data column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'finance_schema' 
            AND table_name = 'obligation_items'
            AND column_name = 'item_data'
        ) THEN
            ALTER TABLE finance_schema.obligation_items 
            ADD COLUMN item_data JSONB;
            
            -- Migrate existing data
            UPDATE finance_schema.obligation_items
            SET item_data = jsonb_build_object(
                'description', description,
                'monthly_emi', monthly_emi
            );
        END IF;

        -- Make description and monthly_emi nullable (they're now in item_data)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'finance_schema' 
            AND table_name = 'obligation_items'
            AND column_name = 'description'
            AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE finance_schema.obligation_items 
            ALTER COLUMN description DROP NOT NULL;
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'finance_schema' 
            AND table_name = 'obligation_items'
            AND column_name = 'monthly_emi'
            AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE finance_schema.obligation_items 
            ALTER COLUMN monthly_emi DROP NOT NULL;
        END IF;

        -- Add order_index if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'finance_schema' 
            AND table_name = 'obligation_items'
            AND column_name = 'order_index'
        ) THEN
            ALTER TABLE finance_schema.obligation_items 
            ADD COLUMN order_index INTEGER DEFAULT 0;
        END IF;
    END IF;
END $$;

-- Step 3: Create new template tables (already handled by schema.sql, but ensure they exist)
-- This is a no-op if tables already exist due to CREATE TABLE IF NOT EXISTS

-- Step 4: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_cam_templates_active ON finance_schema.cam_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_cam_fields_template_id ON finance_schema.cam_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_cam_fields_section ON finance_schema.cam_fields(template_id, section_name);
CREATE INDEX IF NOT EXISTS idx_cam_entries_template_id ON finance_schema.cam_entries(template_id);
CREATE INDEX IF NOT EXISTS idx_obligation_templates_active ON finance_schema.obligation_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_obligation_fields_template_id ON finance_schema.obligation_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_obligation_sheets_template_id ON finance_schema.obligation_sheets(template_id);

-- Step 5: Add triggers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_cam_templates_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_cam_templates_updated_at
        BEFORE UPDATE ON finance_schema.cam_templates
        FOR EACH ROW
        EXECUTE FUNCTION crm_schema.update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_obligation_templates_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_obligation_templates_updated_at
        BEFORE UPDATE ON finance_schema.obligation_templates
        FOR EACH ROW
        EXECUTE FUNCTION crm_schema.update_updated_at_column();
    END IF;
END $$;

