'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Shield, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Dropdown from '@/components/Dropdown';
import api from '@/lib/api';
import { motion } from 'framer-motion';
import { getErrorMessage } from '@/utils/errorHandler';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
  roleIds?: string[];
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      const errorMessage = getErrorMessage(error);
      // Only show alert if it's not a permission issue (403) - those are handled by RBAC
      if (error instanceof Error && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status !== 403) {
          alert(`Failed to load users: ${errorMessage}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get('/admin/roles');
      setAllRoles(response.data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const response = await api.get(`/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (selectedUser) {
        // Update existing user
        const updateData: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          isActive: formData.isActive,
        };
        if (formData.email !== selectedUser.email) {
          updateData.email = formData.email;
        }
        if (formData.password) {
          updateData.password = formData.password;
        }
        await api.patch(`/admin/users/${selectedUser.id}`, updateData);
        setEditModalOpen(false);
      } else {
        // Create new user
        await api.post('/admin/users', formData);
        setModalOpen(false);
      }
      setFormData({ email: '', password: '', firstName: '', lastName: '', isActive: true });
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      alert(`Failed to ${selectedUser ? 'update' : 'create'} user: ${errorMessage}`);
      console.error('User operation error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (user: User) => {
    try {
      const userDetails = await fetchUserDetails(user.id);
      setSelectedUser(userDetails);
      setFormData({
        email: userDetails.email,
        password: '', // Don't pre-fill password
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        isActive: userDetails.isActive,
      });
      setEditModalOpen(true);
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      alert(`Failed to load user: ${errorMessage}`);
    }
  };

  const handleManageRoles = async (user: User) => {
    try {
      const userDetails = await fetchUserDetails(user.id);
      setSelectedUser(userDetails);
      setRolesModalOpen(true);
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      alert(`Failed to load user roles: ${errorMessage}`);
    }
  };

  const handleToggleRole = async (roleId: string) => {
    if (!selectedUser) return;

    // Check if user has this role (handle both object and string formats)
    const hasRole = 
      (Array.isArray(selectedUser.roles) && 
       selectedUser.roles.some((r: any) => 
         (typeof r === 'object' ? r.id : null) === roleId || 
         (typeof r === 'string' ? allRoles.find(role => role.id === roleId)?.name === r : false)
       )) ||
      selectedUser.roleIds?.includes(roleId);

    try {
      if (hasRole) {
        await api.delete(`/admin/users/${selectedUser.id}/roles/${roleId}`);
      } else {
        await api.post(`/admin/users/${selectedUser.id}/roles`, { roleId });
      }
      // Refresh user details
      const userDetails = await fetchUserDetails(selectedUser.id);
      setSelectedUser(userDetails);
      fetchUsers(); // Refresh the list to update role displays
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      alert(`Failed to ${hasRole ? 'remove' : 'assign'} role: ${errorMessage}`);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (user: User) => (
        <div>
          <div className="font-medium">{`${user.firstName} ${user.lastName}`}</div>
          <div className="text-sm text-gray-500">{user.email}</div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (user: User) => (
        <div className="flex flex-wrap gap-1">
          {user.roles?.length > 0 ? (
            user.roles.map((role) => (
              <span
                key={role}
                className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium"
              >
                {role}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-sm">No roles</span>
          )}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (user: User) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            user.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (user: User) => (
        <div className="flex justify-end">
          <Dropdown
            items={[
              {
                label: 'Edit User',
                onClick: () => handleEdit(user),
                icon: <Edit className="w-4 h-4" />,
              },
              {
                label: 'Manage Roles',
                onClick: () => handleManageRoles(user),
                icon: <Shield className="w-4 h-4" />,
              },
            ]}
          />
        </div>
      ),
    },
  ];

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage user accounts and permissions"
        action={
          <Button icon={<Plus className="w-5 h-5" />} onClick={() => setModalOpen(true)}>
            Create User
          </Button>
        }
      />

      <Table columns={columns} data={users} keyExtractor={(user) => user.id} />

      {/* Create User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setFormData({ email: '', password: '', firstName: '', lastName: '', isActive: true });
        }}
        title="Create User"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
          <Input
            label="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            label="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setModalOpen(false);
                setFormData({ email: '', password: '', firstName: '', lastName: '', isActive: true });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedUser(null);
          setFormData({ email: '', password: '', firstName: '', lastName: '', isActive: true });
        }}
        title="Edit User"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Leave blank to keep current password"
          />
          <Input
            label="First Name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            label="Last Name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setEditModalOpen(false);
                setSelectedUser(null);
                setFormData({ email: '', password: '', firstName: '', lastName: '', isActive: true });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Update User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Roles Modal */}
      <Modal
        isOpen={rolesModalOpen}
        onClose={() => {
          setRolesModalOpen(false);
          setSelectedUser(null);
        }}
        title={`Manage Roles - ${selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Assign or remove roles for this user. Users inherit all permissions from their assigned roles.
          </p>

          <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-4">
            {allRoles.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No roles available</p>
            ) : (
              allRoles.map((role) => {
                // Check if user has this role (handle both object and string formats)
                const hasRole = 
                  (Array.isArray(selectedUser?.roles) && 
                   selectedUser.roles.some((r: any) => 
                     (typeof r === 'object' ? r.id : null) === role.id || 
                     (typeof r === 'string' ? r === role.name : false)
                   )) ||
                  selectedUser?.roleIds?.includes(role.id);
                return (
                  <div
                    key={role.id}
                    className={`flex items-start justify-between p-3 rounded-lg border-2 transition-colors ${
                      hasRole
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={hasRole || false}
                          onChange={() => handleToggleRole(role.id)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <label className="font-medium text-gray-900 cursor-pointer">
                          {role.name}
                        </label>
                      </div>
                      {role.description && (
                        <p className="text-sm text-gray-600 mt-1 ml-6">
                          {role.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-primary-600">
                {(() => {
                  if (!selectedUser?.roles) return 0;
                  return Array.isArray(selectedUser.roles) 
                    ? selectedUser.roles.filter((r: any) => r !== null).length 
                    : 0;
                })()}
              </span>{' '}
              of {allRoles.length} roles assigned
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setRolesModalOpen(false);
                setSelectedUser(null);
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

