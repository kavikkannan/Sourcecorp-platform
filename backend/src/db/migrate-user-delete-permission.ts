import { query } from './pool';

export async function migrateUserDeletePermission(): Promise<void> {
  try {
    // Add admin.users.delete permission
    await query(
      `INSERT INTO auth_schema.permissions (name, description)
       VALUES ('admin.users.delete', 'Delete users')
       ON CONFLICT (name) DO NOTHING`
    );

    // Assign to Admin role
    await query(
      `INSERT INTO auth_schema.role_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM auth_schema.roles r, auth_schema.permissions p
       WHERE r.name = 'Admin' AND p.name = 'admin.users.delete'
       ON CONFLICT (role_id, permission_id) DO NOTHING`
    );

    console.log('User delete permission migration completed successfully');
  } catch (error) {
    console.error('Error migrating user delete permission:', error);
    throw error;
  }
}

// Run migration if called directly
migrateUserDeletePermission()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

