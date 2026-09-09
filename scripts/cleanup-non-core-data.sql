-- =============================================================================
-- Cleanup script: remove all case / operational data and non-admin users,
-- while keeping admin users, roles, permissions, templates, hierarchy, and teams.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Find an admin user to own the templates after non-admin users are deleted.
--    Abort if no admin exists.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT u.id INTO admin_id
  FROM auth_schema.users u
  JOIN auth_schema.user_roles ur ON u.id = ur.user_id
  JOIN auth_schema.roles r ON ur.role_id = r.id
  WHERE r.name IN ('Admin', 'super_admin')
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Cleanup aborted.';
  END IF;

  -- Reassign template ownership to the admin user so we can safely delete creators.
  UPDATE finance_schema.cam_templates SET created_by = admin_id;
  UPDATE finance_schema.obligation_templates SET created_by = admin_id;
  UPDATE finance_schema.eligibility_rules SET created_by = admin_id;

  PERFORM set_config('app.admin_user_id', admin_id::text, true);
END $$;

-- -----------------------------------------------------------------------------
-- 2. CRM / CASE DATA
-- -----------------------------------------------------------------------------
DELETE FROM crm_schema.case_notes;
DELETE FROM crm_schema.case_status_history;
DELETE FROM crm_schema.case_assignments;
DELETE FROM crm_schema.documents;
DELETE FROM crm_schema.customer_detail_sheets;
DELETE FROM crm_schema.customer_detail_change_requests;
DELETE FROM crm_schema.case_notifications;
DELETE FROM crm_schema.notification_preferences;
DELETE FROM crm_schema.cases;

-- -----------------------------------------------------------------------------
-- 3. FINANCE / CALCULATIONS & REPORTS
-- -----------------------------------------------------------------------------
DELETE FROM finance_schema.eligibility_calculations;
DELETE FROM finance_schema.cam_entries;
DELETE FROM finance_schema.obligation_items;
DELETE FROM finance_schema.obligation_sheets;
DELETE FROM finance_schema.daily_reports;

-- -----------------------------------------------------------------------------
-- 4. ADMIN / ANNOUNCEMENTS & RECOGNITIONS
-- -----------------------------------------------------------------------------
DELETE FROM admin_schema.announcements;
DELETE FROM admin_schema.recognitions;

-- -----------------------------------------------------------------------------
-- 5. TASKS
-- -----------------------------------------------------------------------------
DELETE FROM task_schema.task_comments;
DELETE FROM task_schema.tasks;

-- -----------------------------------------------------------------------------
-- 6. AUDIT & ERROR LOGS
-- -----------------------------------------------------------------------------
DELETE FROM audit_schema.audit_logs;
DELETE FROM audit_schema.error_logs;

-- -----------------------------------------------------------------------------
-- 7. DELETE NON-ADMIN USERS
--    Admin roles: 'Admin' and 'super_admin'. Everything else is removed.
--    Cascades: user_roles, team_members, user_hierarchy.
-- -----------------------------------------------------------------------------
DELETE FROM auth_schema.users
WHERE id NOT IN (
  SELECT DISTINCT u.id
  FROM auth_schema.users u
  JOIN auth_schema.user_roles ur ON u.id = ur.user_id
  JOIN auth_schema.roles r ON ur.role_id = r.id
  WHERE r.name IN ('Admin', 'super_admin')
);

COMMIT;
