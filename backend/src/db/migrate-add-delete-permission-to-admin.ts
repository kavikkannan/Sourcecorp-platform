import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Add crm.case.delete permission to Admin role...');

    // First, ensure the permission exists
    await pool.query(`
      INSERT INTO auth_schema.permissions (name, description) 
      VALUES ('crm.case.delete', 'Delete loan cases')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Assign crm.case.delete permission to Admin role
    const result = await pool.query(`
      INSERT INTO auth_schema.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth_schema.roles r, auth_schema.permissions p
      WHERE r.name = 'Admin' 
      AND p.name = 'crm.case.delete'
      ON CONFLICT (role_id, permission_id) DO NOTHING
      RETURNING role_id, permission_id;
    `);

    if (result.rows.length > 0) {
      logger.info(`Migration completed: Added crm.case.delete permission to Admin role.`);
    } else {
      logger.info('Migration completed: Permission already assigned to Admin role (or Admin role/permission does not exist).');
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

