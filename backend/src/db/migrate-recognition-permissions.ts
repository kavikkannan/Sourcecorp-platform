import { pool } from './pool';
import { logger } from '../config/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration script to add recognition permissions and assign to admin roles
 */
const runRecognitionPermissionsMigration = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Starting recognition permissions migration...');

    // Insert permissions
    await client.query(`
      INSERT INTO auth_schema.permissions (name, description) VALUES
        ('admin.recognitions.create', 'Create recognitions (Monthly Achiever / Best Employee)'),
        ('admin.recognitions.read', 'View recognitions'),
        ('admin.recognitions.update', 'Update recognitions'),
        ('admin.recognitions.delete', 'Delete recognitions')
      ON CONFLICT (name) DO NOTHING
    `);

    // Assign to Admin role
    await client.query(`
      INSERT INTO auth_schema.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth_schema.roles r, auth_schema.permissions p
      WHERE r.name = 'Admin' AND p.name LIKE 'admin.recognitions.%'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // Assign to super_admin role if exists
    await client.query(`
      INSERT INTO auth_schema.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth_schema.roles r, auth_schema.permissions p
      WHERE r.name = 'super_admin' AND p.name LIKE 'admin.recognitions.%'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    await client.query('COMMIT');

    logger.info('✓ Recognition permissions migration completed successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Recognition permissions migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

runRecognitionPermissionsMigration()
  .then(() => {
    logger.info('Recognition permissions migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Recognition permissions migration process failed:', error);
    process.exit(1);
  });
