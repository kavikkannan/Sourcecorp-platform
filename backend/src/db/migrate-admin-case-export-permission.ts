import { pool } from './pool';
import { logger } from '../config/logger';

/**
 * Migration script to add admin case export permission and assign to admin roles
 */
const runAdminCaseExportPermissionMigration = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Starting admin case export permission migration...');

    // Insert permission
    await client.query(`
      INSERT INTO auth_schema.permissions (name, description) VALUES
        ('admin.case.export', 'Export cases from the admin panel with full system access')
      ON CONFLICT (name) DO NOTHING
    `);

    // Assign to Admin role
    await client.query(`
      INSERT INTO auth_schema.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth_schema.roles r, auth_schema.permissions p
      WHERE r.name = 'Admin' AND p.name = 'admin.case.export'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // Assign to super_admin role if exists
    await client.query(`
      INSERT INTO auth_schema.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth_schema.roles r, auth_schema.permissions p
      WHERE r.name = 'super_admin' AND p.name = 'admin.case.export'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await client.query('COMMIT');

    logger.info('✓ Admin case export permission migration completed successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Admin case export permission migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

runAdminCaseExportPermissionMigration()
  .then(() => {
    logger.info('Admin case export permission migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Admin case export permission migration process failed:', error);
    process.exit(1);
  });
