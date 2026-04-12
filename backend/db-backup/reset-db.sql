-- Safe Database Reset Script
BEGIN;

-- 1. Reassign ownership of things we want to keep to admin (to avoid foreign key errors on user deletion)
UPDATE admin_schema.announcements 
SET author_id = (SELECT id FROM auth_schema.users WHERE email = 'admin@gmail.com');

UPDATE finance_schema.cam_templates 
SET created_by = (SELECT id FROM auth_schema.users WHERE email = 'admin@gmail.com');

UPDATE finance_schema.obligation_templates 
SET created_by = (SELECT id FROM auth_schema.users WHERE email = 'admin@gmail.com');

UPDATE finance_schema.eligibility_rules
SET created_by = (SELECT id FROM auth_schema.users WHERE email = 'admin@gmail.com');

-- 2. Truncate Cases, which will CASCADE to all case-related tables 
-- (case_notes, case_assignments, documents, etc.)
TRUNCATE TABLE crm_schema.cases CASCADE;

-- Optional: Truncate chats, messages, and tasks, since they belong to cases or specific users.
TRUNCATE TABLE chat_schema.channels CASCADE;
TRUNCATE TABLE chat_schema.messages CASCADE;
TRUNCATE TABLE task_schema.tasks CASCADE;
TRUNCATE TABLE note_schema.notes CASCADE;
TRUNCATE TABLE chat_schema.channel_creation_requests CASCADE;

-- We also need to purge finance obligations/cam entries so they don't break either
TRUNCATE TABLE finance_schema.cam_entries CASCADE;
TRUNCATE TABLE finance_schema.obligation_sheets CASCADE;

-- Also purge audit logs because they reference users that will be deleted
TRUNCATE TABLE audit_schema.audit_logs CASCADE;

-- If there are user hierarchy references, we may need to drop them or they might cascade on delete
DELETE FROM auth_schema.user_hierarchy;

-- 3. Delete users who are NOT in the protected list.
DELETE FROM auth_schema.users 
WHERE email NOT IN (
    'admin@gmail.com', 
    'VIGNESWAR@SOURCECORP.IN', 
    'shayinabegum@sourcecorp.in'
);

COMMIT;
