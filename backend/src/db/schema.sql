-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth_schema;
CREATE SCHEMA IF NOT EXISTS admin_schema;
CREATE SCHEMA IF NOT EXISTS audit_schema;
CREATE SCHEMA IF NOT EXISTS crm_schema;
CREATE SCHEMA IF NOT EXISTS finance_schema;
CREATE SCHEMA IF NOT EXISTS task_schema;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AUTH SCHEMA
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS auth_schema.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE IF NOT EXISTS auth_schema.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS auth_schema.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS auth_schema.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES auth_schema.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES auth_schema.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- User roles mapping
CREATE TABLE IF NOT EXISTS auth_schema.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES auth_schema.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

-- Teams table
CREATE TABLE IF NOT EXISTS auth_schema.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members mapping
CREATE TABLE IF NOT EXISTS auth_schema.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES auth_schema.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- ============================================
-- ADMIN SCHEMA
-- ============================================

-- Announcements table
CREATE TABLE IF NOT EXISTS admin_schema.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES auth_schema.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT SCHEMA
-- ============================================

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_schema.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth_schema.users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON auth_schema.users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON auth_schema.users(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON auth_schema.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON auth_schema.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON auth_schema.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON auth_schema.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON auth_schema.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON auth_schema.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON admin_schema.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_schema.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_schema.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_schema.audit_logs(action);

-- ============================================
-- CRM SCHEMA (PHASE 2)
-- ============================================

-- Cases table (main loan case records)
CREATE TABLE IF NOT EXISTS crm_schema.cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    loan_type VARCHAR(100) NOT NULL,
    loan_amount DECIMAL(15, 2) NOT NULL,
    current_status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case assignments table
CREATE TABLE IF NOT EXISTS crm_schema.case_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES auth_schema.users(id),
    assigned_by UUID NOT NULL REFERENCES auth_schema.users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case status history table
CREATE TABLE IF NOT EXISTS crm_schema.case_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES auth_schema.users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
);

-- Documents table
CREATE TABLE IF NOT EXISTS crm_schema.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth_schema.users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case notes table
CREATE TABLE IF NOT EXISTS crm_schema.case_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for CRM tables
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON crm_schema.cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_current_status ON crm_schema.cases(current_status);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON crm_schema.cases(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON crm_schema.cases(created_at);
CREATE INDEX IF NOT EXISTS idx_case_assignments_case_id ON crm_schema.case_assignments(case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_assigned_to ON crm_schema.case_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_case_status_history_case_id ON crm_schema.case_status_history(case_id);
CREATE INDEX IF NOT EXISTS idx_case_status_history_changed_at ON crm_schema.case_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON crm_schema.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON crm_schema.case_notes(case_id);

-- Function to generate unique case numbers
CREATE OR REPLACE FUNCTION crm_schema.generate_case_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER;
BEGIN
    SELECT COUNT(*) INTO counter FROM crm_schema.cases;
    new_number := 'CASE-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((counter + 1)::TEXT, 5, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate case number
CREATE OR REPLACE FUNCTION crm_schema.set_case_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
        NEW.case_number := crm_schema.generate_case_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_case_number
    BEFORE INSERT ON crm_schema.cases
    FOR EACH ROW
    EXECUTE FUNCTION crm_schema.set_case_number();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION crm_schema.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cases_updated_at
    BEFORE UPDATE ON crm_schema.cases
    FOR EACH ROW
    EXECUTE FUNCTION crm_schema.update_updated_at_column();

-- ============================================
-- FINANCE SCHEMA (PHASE 3)
-- ============================================

-- Eligibility rules table
CREATE TABLE IF NOT EXISTS finance_schema.eligibility_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_type VARCHAR(100) NOT NULL,
    min_age INTEGER NOT NULL,
    max_age INTEGER NOT NULL,
    max_foir DECIMAL(5, 2) NOT NULL,
    income_multiplier DECIMAL(5, 2) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Eligibility calculations table
CREATE TABLE IF NOT EXISTS finance_schema.eligibility_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    monthly_income DECIMAL(15, 2) NOT NULL,
    eligible_amount DECIMAL(15, 2) NOT NULL,
    requested_amount DECIMAL(15, 2) NOT NULL,
    result VARCHAR(20) NOT NULL CHECK (result IN ('ELIGIBLE', 'NOT_ELIGIBLE')),
    rule_snapshot JSONB NOT NULL,
    calculated_by UUID NOT NULL REFERENCES auth_schema.users(id),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Obligation sheets table
CREATE TABLE IF NOT EXISTS finance_schema.obligation_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    total_obligation DECIMAL(15, 2) NOT NULL,
    net_income DECIMAL(15, 2) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Obligation items table
CREATE TABLE IF NOT EXISTS finance_schema.obligation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obligation_sheet_id UUID NOT NULL REFERENCES finance_schema.obligation_sheets(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    monthly_emi DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CAM templates table (admin-defined templates based on real bank formats)
CREATE TABLE IF NOT EXISTS finance_schema.cam_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_type VARCHAR(100) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    sections JSONB NOT NULL, -- Array of section definitions
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(loan_type, template_name)
);

-- CAM fields table (defines fields within CAM template sections)
CREATE TABLE IF NOT EXISTS finance_schema.cam_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES finance_schema.cam_templates(id) ON DELETE CASCADE,
    section_name VARCHAR(255) NOT NULL,
    field_key VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'currency', 'date', 'select')),
    is_mandatory BOOLEAN DEFAULT false,
    is_user_addable BOOLEAN DEFAULT false, -- Whether users can add this field themselves
    order_index INTEGER NOT NULL DEFAULT 0,
    default_value TEXT,
    validation_rules JSONB, -- e.g., {"min": 0, "max": 100, "pattern": "..."}
    select_options JSONB, -- For select type fields: ["Option1", "Option2"]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, section_name, field_key)
);

-- Obligation templates table (admin-defined templates based on real bank formats)
CREATE TABLE IF NOT EXISTS finance_schema.obligation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(255) NOT NULL UNIQUE,
    sections JSONB NOT NULL, -- Array of section definitions
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Obligation fields table (defines fields for obligation items)
CREATE TABLE IF NOT EXISTS finance_schema.obligation_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES finance_schema.obligation_templates(id) ON DELETE CASCADE,
    field_key VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'currency', 'date', 'select')),
    is_mandatory BOOLEAN DEFAULT false,
    is_repeatable BOOLEAN DEFAULT true, -- Whether this field can appear in multiple obligation rows
    order_index INTEGER NOT NULL DEFAULT 0,
    default_value TEXT,
    validation_rules JSONB,
    select_options JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, field_key)
);

-- CAM entries table (updated to store template snapshot)
CREATE TABLE IF NOT EXISTS finance_schema.cam_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    template_id UUID REFERENCES finance_schema.cam_templates(id),
    template_snapshot JSONB NOT NULL, -- Snapshot of template at time of creation
    cam_data JSONB NOT NULL, -- Includes mandatory fields + user-added fields
    user_added_fields JSONB, -- Metadata about user-added fields: {"field_key": {"label": "...", "type": "..."}}
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Obligation sheets table (updated to reference template)
CREATE TABLE IF NOT EXISTS finance_schema.obligation_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    template_id UUID REFERENCES finance_schema.obligation_templates(id),
    template_snapshot JSONB, -- Snapshot of template at time of creation
    total_obligation DECIMAL(15, 2) NOT NULL,
    net_income DECIMAL(15, 2) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Obligation items table (updated to support template-driven fields)
CREATE TABLE IF NOT EXISTS finance_schema.obligation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obligation_sheet_id UUID NOT NULL REFERENCES finance_schema.obligation_sheets(id) ON DELETE CASCADE,
    item_data JSONB NOT NULL, -- All fields from template stored as JSONB
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for finance tables
CREATE INDEX IF NOT EXISTS idx_eligibility_rules_loan_type ON finance_schema.eligibility_rules(loan_type);
CREATE INDEX IF NOT EXISTS idx_eligibility_calculations_case_id ON finance_schema.eligibility_calculations(case_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_calculations_calculated_at ON finance_schema.eligibility_calculations(calculated_at);
CREATE INDEX IF NOT EXISTS idx_obligation_sheets_case_id ON finance_schema.obligation_sheets(case_id);
CREATE INDEX IF NOT EXISTS idx_obligation_items_sheet_id ON finance_schema.obligation_items(obligation_sheet_id);
CREATE INDEX IF NOT EXISTS idx_cam_templates_loan_type ON finance_schema.cam_templates(loan_type);
CREATE INDEX IF NOT EXISTS idx_cam_templates_active ON finance_schema.cam_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_cam_fields_template_id ON finance_schema.cam_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_cam_fields_section ON finance_schema.cam_fields(template_id, section_name);
CREATE INDEX IF NOT EXISTS idx_cam_entries_case_id ON finance_schema.cam_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_cam_entries_version ON finance_schema.cam_entries(case_id, version);
CREATE INDEX IF NOT EXISTS idx_cam_entries_template_id ON finance_schema.cam_entries(template_id);
CREATE INDEX IF NOT EXISTS idx_obligation_templates_active ON finance_schema.obligation_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_obligation_fields_template_id ON finance_schema.obligation_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_obligation_sheets_template_id ON finance_schema.obligation_sheets(template_id);

-- Trigger to update obligation_sheets updated_at timestamp
CREATE TRIGGER trigger_update_obligation_sheets_updated_at
    BEFORE UPDATE ON finance_schema.obligation_sheets
    FOR EACH ROW
    EXECUTE FUNCTION crm_schema.update_updated_at_column();

-- Trigger to update cam_templates updated_at timestamp
CREATE TRIGGER trigger_update_cam_templates_updated_at
    BEFORE UPDATE ON finance_schema.cam_templates
    FOR EACH ROW
    EXECUTE FUNCTION crm_schema.update_updated_at_column();

-- Trigger to update obligation_templates updated_at timestamp
CREATE TRIGGER trigger_update_obligation_templates_updated_at
    BEFORE UPDATE ON finance_schema.obligation_templates
    FOR EACH ROW
    EXECUTE FUNCTION crm_schema.update_updated_at_column();

-- ============================================
-- HIERARCHY SCHEMA (REPORTING STRUCTURE)
-- ============================================

-- User hierarchy table (manager-subordinate relationships)
CREATE TABLE IF NOT EXISTS auth_schema.user_hierarchy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    subordinate_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subordinate_id),
    CONSTRAINT check_no_self_reference CHECK (manager_id != subordinate_id)
);

-- Function to check for circular hierarchy
CREATE OR REPLACE FUNCTION auth_schema.check_hierarchy_cycle()
RETURNS TRIGGER AS $$
DECLARE
    current_manager UUID;
    visited UUID[] := ARRAY[NEW.subordinate_id];
BEGIN
    -- Traverse up the hierarchy to check for cycles
    current_manager := NEW.manager_id;
    
    WHILE current_manager IS NOT NULL LOOP
        -- If we've visited this manager before, we have a cycle
        IF current_manager = ANY(visited) THEN
            RAISE EXCEPTION 'Circular hierarchy detected: cannot create cycle in reporting structure';
        END IF;
        
        -- Add current manager to visited
        visited := array_append(visited, current_manager);
        
        -- Get the manager of the current manager
        SELECT manager_id INTO current_manager
        FROM auth_schema.user_hierarchy
        WHERE subordinate_id = current_manager;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent circular hierarchy
CREATE TRIGGER trigger_check_hierarchy_cycle
    BEFORE INSERT OR UPDATE ON auth_schema.user_hierarchy
    FOR EACH ROW
    EXECUTE FUNCTION auth_schema.check_hierarchy_cycle();

-- Indexes for hierarchy
CREATE INDEX IF NOT EXISTS idx_user_hierarchy_manager_id ON auth_schema.user_hierarchy(manager_id);
CREATE INDEX IF NOT EXISTS idx_user_hierarchy_subordinate_id ON auth_schema.user_hierarchy(subordinate_id);

-- ============================================
-- TASK SCHEMA (HIERARCHICAL TASK MANAGEMENT)
-- ============================================

-- Tasks table
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
);

-- Function to validate task assignment based on hierarchy
CREATE OR REPLACE FUNCTION task_schema.validate_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
    is_subordinate BOOLEAN;
    is_manager BOOLEAN;
BEGIN
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
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate task assignment
CREATE TRIGGER trigger_validate_task_assignment
    BEFORE INSERT OR UPDATE ON task_schema.tasks
    FOR EACH ROW
    EXECUTE FUNCTION task_schema.validate_task_assignment();

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON task_schema.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON task_schema.tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON task_schema.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_direction ON task_schema.tasks(direction);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON task_schema.tasks(created_at);

-- Trigger to update tasks updated_at timestamp
CREATE TRIGGER trigger_update_tasks_updated_at
    BEFORE UPDATE ON task_schema.tasks
    FOR EACH ROW
    EXECUTE FUNCTION crm_schema.update_updated_at_column();

