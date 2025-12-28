'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Shield, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Dropdown from '@/components/Dropdown';
import api from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandler';

interface Role {
  id: string;
  name: string;
  description: string | null;
  user_count: number;
  permission_count: number;
  created_at: string;
  permissions?: Permission[];
}

interface Permission {
  id: string;
  name: string;
  description: string | null;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await api.get('/admin/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await api.get('/admin/permissions');
      setAllPermissions(response.data);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const fetchRoleDetails = async (roleId: string) => {
    try {
      const response = await api.get(`/admin/roles/${roleId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch role details:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (selectedRole) {
        // Update existing role
        await api.patch(`/admin/roles/${selectedRole.id}`, formData);
        setEditModalOpen(false);
      } else {
        // Create new role
        await api.post('/admin/roles', formData);
        setModalOpen(false);
      }
      setFormData({ name: '', description: '' });
      setSelectedRole(null);
      fetchRoles();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      alert(`Failed to ${selectedRole ? 'update' : 'create'} role: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (role: Role) => {
    try {
      const roleDetails = await fetchRoleDetails(role.id);
      setSelectedRole(roleDetails);
      setFormData({
        name: roleDetails.name,
        description: roleDetails.description || '',
      });
      setEditModalOpen(true);
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      alert(`Failed to load role: ${errorMessage}`);
    }
  };

  const handleManagePermissions = async (role: Role) => {
    try {
      const roleDetails = await fetchRoleDetails(role.id);
      setSelectedRole(roleDetails);
      setPermissionsModalOpen(true);
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      alert(`Failed to load role permissions: ${errorMessage}`);
    }
  };

  const handleTogglePermission = async (permissionId: string) => {
    if (!selectedRole) return;

    const hasPermission = selectedRole.permissions?.some((p) => p.id === permissionId);

    try {
      if (hasPermission) {
        await api.delete(`/admin/roles/${selectedRole.id}/permissions/${permissionId}`);
      } else {
        await api.post(`/admin/roles/${selectedRole.id}/permissions`, {
          permissionId,
        });
      }
      // Refresh role details
      const roleDetails = await fetchRoleDetails(selectedRole.id);
      setSelectedRole(roleDetails);
      fetchRoles(); // Refresh the list to update permission counts
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      alert(`Failed to ${hasPermission ? 'remove' : 'assign'} permission: ${errorMessage}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the role "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/admin/roles/${id}`);
      fetchRoles();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      alert(`Failed to delete role: ${errorMessage}`);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Role Name',
      render: (role: Role) => (
        <div>
          <div className="font-medium">{role.name}</div>
          {role.description && (
            <div className="text-sm text-gray-500">{role.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'user_count',
      header: 'Users',
      render: (role: Role) => (
        <span className="text-gray-700">{role.user_count}</span>
      ),
    },
    {
      key: 'permission_count',
      header: 'Permissions',
      render: (role: Role) => (
        <div>
          <span className="text-gray-700 font-medium">{role.permission_count}</span>
          {role.permission_count > 0 && (
            <span className="text-xs text-gray-500 ml-1">assigned</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (role: Role) => (
        <div className="flex justify-end">
          <Dropdown
            items={[
              {
                label: 'Edit Role',
                onClick: () => handleEdit(role),
                icon: <Edit className="w-4 h-4" />,
              },
              {
                label: 'Manage Permissions',
                onClick: () => handleManagePermissions(role),
                icon: <Shield className="w-4 h-4" />,
              },
              {
                label: 'Delete Role',
                onClick: () => handleDelete(role.id, role.name),
                icon: <Trash2 className="w-4 h-4" />,
                variant: 'danger',
              },
            ]}
          />
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title="Roles" description="Manage roles and permissions" />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600">Loading roles...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Manage roles and permissions"
        action={
          <Button icon={<Plus className="w-5 h-5" />} onClick={() => setModalOpen(true)}>
            Create Role
          </Button>
        }
      />

      {roles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No roles found</h3>
          <p className="text-gray-600 mb-6">Get started by creating your first role.</p>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Role
          </Button>
        </div>
      ) : (
        <Table columns={columns} data={roles} keyExtractor={(role) => role.id} />
      )}

      {/* Create Role Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setFormData({ name: '', description: '' });
        }}
        title="Create Role"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Role Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., Loan Officer"
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              rows={3}
              placeholder="Describe the role's responsibilities..."
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setModalOpen(false);
                setFormData({ name: '', description: '' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create Role
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedRole(null);
          setFormData({ name: '', description: '' });
        }}
        title="Edit Role"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Role Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setEditModalOpen(false);
                setSelectedRole(null);
                setFormData({ name: '', description: '' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Update Role
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Permissions Modal */}
      <Modal
        isOpen={permissionsModalOpen}
        onClose={() => {
          setPermissionsModalOpen(false);
          setSelectedRole(null);
        }}
        title={`Manage Permissions - ${selectedRole?.name || ''}`}
      >
        <div className="space-y-4 overflow-visible">
          <p className="text-sm text-gray-600 mb-4">
            Select permissions to assign to this role. Permissions control what actions users with this role can perform.
          </p>

          {(() => {
            // Categorize permissions
            const categories: Record<string, Permission[]> = {};
            allPermissions.forEach((permission) => {
              const category = permission.name.split('.')[0] || 'Other';
              if (!categories[category]) {
                categories[category] = [];
              }
              categories[category].push(permission);
            });

            // Sort categories: CRM, Finance, Admin, Other
            const categoryOrder = ['crm', 'finance', 'admin', 'Other'];
            const sortedCategories = Object.keys(categories).sort((a, b) => {
              const aIndex = categoryOrder.indexOf(a.toLowerCase());
              const bIndex = categoryOrder.indexOf(b.toLowerCase());
              if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
              if (aIndex === -1) return 1;
              if (bIndex === -1) return -1;
              return aIndex - bIndex;
            });

            return (
              <div className="max-h-96 overflow-y-auto space-y-4">
                {allPermissions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No permissions available</p>
                ) : (
                  sortedCategories.map((category) => {
                    const categoryPermissions = categories[category];
                    const assignedInCategory = categoryPermissions.filter((p) =>
                      selectedRole?.permissions?.some((rp) => rp.id === p.id)
                    );
                    const allAssigned = assignedInCategory.length === categoryPermissions.length;
                    const someAssigned = assignedInCategory.length > 0 && !allAssigned;

                    const handleSelectAllCategory = async () => {
                      if (!selectedRole) return;
                      
                      const unassigned = categoryPermissions.filter(
                        (p) => !selectedRole.permissions?.some((rp) => rp.id === p.id)
                      );

                      try {
                        // Assign all unassigned permissions in this category
                        await Promise.all(
                          unassigned.map((p) =>
                            api.post(`/admin/roles/${selectedRole.id}/permissions`, {
                              permissionId: p.id,
                            })
                          )
                        );
                        // Refresh role details
                        const roleDetails = await fetchRoleDetails(selectedRole.id);
                        setSelectedRole(roleDetails);
                        fetchRoles();
                      } catch (error: any) {
                        const errorMessage = getErrorMessage(error);
                        alert(`Failed to assign permissions: ${errorMessage}`);
                      }
                    };

                    const handleDeselectAllCategory = async () => {
                      if (!selectedRole) return;
                      
                      const assigned = categoryPermissions.filter((p) =>
                        selectedRole.permissions?.some((rp) => rp.id === p.id)
                      );

                      try {
                        // Remove all assigned permissions in this category
                        await Promise.all(
                          assigned.map((p) =>
                            api.delete(
                              `/admin/roles/${selectedRole.id}/permissions/${p.id}`
                            )
                          )
                        );
                        // Refresh role details
                        const roleDetails = await fetchRoleDetails(selectedRole.id);
                        setSelectedRole(roleDetails);
                        fetchRoles();
                      } catch (error: any) {
                        const errorMessage = getErrorMessage(error);
                        alert(`Failed to remove permissions: ${errorMessage}`);
                      }
                    };

                    return (
                      <div key={category} className="border border-gray-200 rounded-lg p-4 overflow-visible">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                            {category.toUpperCase()}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {assignedInCategory.length} / {categoryPermissions.length}
                            </span>
                            <Button
                              variant="secondary"
                              onClick={
                                allAssigned
                                  ? handleDeselectAllCategory
                                  : handleSelectAllCategory
                              }
                              className="text-xs px-2 py-1 h-auto"
                            >
                              {allAssigned ? 'Deselect All' : 'Select All'}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2 overflow-visible">
                          {categoryPermissions.map((permission) => {
                            const isAssigned = selectedRole?.permissions?.some(
                              (p) => p.id === permission.id
                            );
                            return (
                              <div
                                key={permission.id}
                                className={`flex items-start justify-between p-2 rounded-lg border transition-colors relative overflow-visible ${
                                  isAssigned
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isAssigned || false}
                                      onChange={() => handleTogglePermission(permission.id)}
                                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                    />
                                    <label className="text-sm font-medium text-gray-900 cursor-pointer">
                                      {permission.name}
                                    </label>
                                  </div>
                                  {permission.description && (
                                    <p className="text-xs text-gray-600 mt-1 ml-6">
                                      {permission.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })()}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-primary-600">
                {selectedRole?.permissions?.length || 0}
              </span>{' '}
              of {allPermissions.length} permissions assigned
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setPermissionsModalOpen(false);
                setSelectedRole(null);
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

