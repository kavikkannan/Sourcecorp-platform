import { pool } from './pool';
import { logger } from '../config/logger';

const runMigration = async () => {
  try {
    logger.info('Starting migration: Add chat.delete, chat.channel.group.create, and chat.channel.rename permissions to Admin role...');

    // Insert the permissions if they don't exist
    await pool.query(`
      INSERT INTO auth_schema.permissions (name, description)
      VALUES 
        ('chat.delete', 'Delete chat messages and channels'),
        ('chat.channel.group.create', 'Create channel groups in chat'),
        ('chat.channel.rename', 'Rename channels and groups')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Assign the permissions to the Admin role
    const result = await pool.query(`
      INSERT INTO auth_schema.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth_schema.roles r, auth_schema.permissions p
      WHERE r.name = 'Admin' 
      AND p.name IN ('chat.delete', 'chat.channel.group.create', 'chat.channel.rename')
      ON CONFLICT (role_id, permission_id) DO NOTHING
      RETURNING role_id, permission_id;
    `);

    if (result.rows.length > 0) {
      logger.info(`Migration completed: Added ${result.rows.length} chat permission(s) to Admin role.`);
    } else {
      logger.info('Migration completed: Permissions already assigned to Admin role (or Admin role/permissions do not exist).');
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

