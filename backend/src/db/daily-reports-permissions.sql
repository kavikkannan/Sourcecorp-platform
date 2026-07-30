-- Daily Reports permissions
INSERT INTO auth_schema.permissions (name, description) VALUES
  ('daily_report.create', 'Submit own daily opening/closing report'),
  ('daily_report.view', 'View own daily reports'),
  ('daily_report.view_subordinates', 'View subordinates daily reports and aggregated stats')
ON CONFLICT (name) DO NOTHING;

-- Every role can submit and view their own reports
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE p.name IN ('daily_report.create', 'daily_report.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Management roles can view subordinate reports
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE p.name = 'daily_report.view_subordinates'
  AND (
    LOWER(r.name) LIKE '%manager%'
    OR LOWER(r.name) LIKE '%head%'
    OR LOWER(r.name) LIKE '%lead%'
    OR LOWER(r.name) LIKE '%executive%'
    OR LOWER(r.name) = 'admin'
    OR LOWER(r.name) = 'super_admin'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
