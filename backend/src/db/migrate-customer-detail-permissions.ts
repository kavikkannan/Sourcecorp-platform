import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Add customer detail permissions...');

    // Create the permissions
    await pool.query(`
      INSERT INTO auth_schema.permissions (name, description) 
      VALUES 
        ('crm.case.customer_details.modify', 'Modify customer details directly'),
        ('crm.case.customer_details.request_change', 'Request changes to customer details')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Assign both permissions to Admin role
    const result = await pool.query(`
      INSERT INTO auth_schema.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth_schema.roles r, auth_schema.permissions p
      WHERE r.name = 'Admin' 
      AND p.name IN ('crm.case.customer_details.modify', 'crm.case.customer_details.request_change')
      ON CONFLICT (role_id, permission_id) DO NOTHING
      RETURNING role_id, permission_id;
    `);

    if (result.rows.length > 0) {
      logger.info(`Migration completed: Added customer detail permissions to Admin role.`);
    } else {
      logger.info('Migration completed: Permissions already assigned to Admin role (or Admin role/permission does not exist).');
    }
  } catch (error) {
    logger.error('Migration failed', error);
    throw error;
  }
};

if (typeof require !== 'undefined' && require.main === module) {
  runMigration()
    .then(() => {
      logger.info('Migration completed');
      if (typeof process !== 'undefined') {
        process.exit(0);
      }
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      if (typeof process !== 'undefined') {
        process.exit(1);
      }
    });
}

export default runMigration;

