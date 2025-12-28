-- CRM Permissions for Phase 2
-- Run this after the main schema is created

-- Insert CRM permissions
INSERT INTO auth_schema.permissions (name, description) VALUES
  ('crm.case.create', 'Create new loan cases'),
  ('crm.case.view', 'View loan cases'),
  ('crm.case.view_all', 'View all loan cases (admin only)'),
  ('crm.case.assign', 'Assign cases to users'),
  ('crm.case.update_status', 'Update case status'),
  ('crm.case.upload_document', 'Upload documents to cases'),
  ('crm.case.add_note', 'Add notes to cases')
ON CONFLICT (name) DO NOTHING;


