'use client';

import { useState, useEffect } from 'react';
import { Users, X, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import { hierarchyService, User, HierarchyNode } from '@/lib/hierarchy';
import api from '@/lib/api';

export default function HierarchyPage() {
  const [tree, setTree] = useState<{ root: HierarchyNode[]; maxDepth: number } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    subordinateId: '',
    managerId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [treeResponse, usersResponse] = await Promise.all([
        hierarchyService.getHierarchyTree(),
        api.get('/admin/users'),
      ]);
      setTree(treeResponse);
      
      // Transform API response (camelCase) to match User type (snake_case)
      const usersData = (Array.isArray(usersResponse.data) 
        ? usersResponse.data 
        : usersResponse.data.users || usersResponse.data.data || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        first_name: user.firstName || user.first_name,
        last_name: user.lastName || user.last_name,
        is_active: user.isActive !== undefined ? user.isActive : user.is_active,
        created_at: user.createdAt || user.created_at,
        updated_at: user.updatedAt || user.updated_at,
      }));
      
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      alert('Failed to load users. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await hierarchyService.assignManager({
        subordinateId: formData.subordinateId,
        managerId: formData.managerId,
      });
      setAssignModalOpen(false);
      setFormData({ subordinateId: '', managerId: '' });
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign manager');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveManager = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      await hierarchyService.removeManager({
        subordinateId: selectedUser.id,
      });
      setRemoveModalOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove manager');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleNode = (userId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderNode = (node: HierarchyNode, depth: number = 0): JSX.Element => {
    const isExpanded = expandedNodes.has(node.user.id);
    const hasSubordinates = node.subordinates.length > 0;

    return (
      <div key={node.user.id} className="relative">
        <div
          className={`flex items-center gap-2 py-3 px-4 rounded-lg hover:bg-gray-50 transition-all ${
            depth === 0 
              ? 'bg-primary-50 border-2 border-primary-300 shadow-md' 
              : depth === 1
              ? 'bg-blue-50 border border-blue-300 shadow-sm'
              : depth === 2
              ? 'bg-indigo-50 border border-indigo-300'
              : depth === 3
              ? 'bg-purple-50 border border-purple-300'
              : 'bg-gray-50 border border-gray-300'
          }`}
          style={{ marginLeft: `${depth * 32}px` }}
        >
          {hasSubordinates ? (
            <button
              onClick={() => toggleNode(node.user.id)}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          ) : (
            <div className="w-6 flex-shrink-0" />
          )}
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              depth === 0 
                ? 'bg-primary-200' 
                : depth === 1
                ? 'bg-blue-200'
                : depth === 2
                ? 'bg-indigo-200'
                : depth === 3
                ? 'bg-purple-200'
                : 'bg-gray-200'
            }`}>
              <Users className={`w-5 h-5 ${
                depth === 0 
                  ? 'text-primary-700' 
                  : depth === 1
                  ? 'text-blue-700'
                  : depth === 2
                  ? 'text-indigo-700'
                  : depth === 3
                  ? 'text-purple-700'
                  : 'text-gray-700'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">
                {node.user.first_name} {node.user.last_name}
              </div>
              <div className="text-sm text-gray-500 truncate">{node.user.email}</div>
            </div>
            <div className={`text-xs font-medium px-2 py-1 rounded flex-shrink-0 ${
              depth === 0 
                ? 'bg-primary-100 text-primary-700' 
                : depth === 1
                ? 'bg-blue-100 text-blue-700'
                : depth === 2
                ? 'bg-indigo-100 text-indigo-700'
                : depth === 3
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              L{node.depth}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                className="text-xs px-3 py-1.5"
                onClick={() => {
                  setSelectedUser(node.user);
                  setFormData({ subordinateId: node.user.id, managerId: '' });
                  setAssignModalOpen(true);
                }}
              >
                Assign Manager
              </Button>
              {node.depth > 0 && (
                <Button
                  variant="danger"
                  className="text-xs px-3 py-1.5"
                  onClick={() => {
                    setSelectedUser(node.user);
                    setRemoveModalOpen(true);
                  }}
                >
                  Remove Manager
                </Button>
              )}
            </div>
          </div>
        </div>
        {hasSubordinates && isExpanded && (
          <div className="mt-2">
            {node.subordinates.map((sub) => renderNode(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading hierarchy...</div>
      </div>
    );
  }

  const availableUsers = users.filter(
    (u) => u.id !== formData.subordinateId && u.is_active
  );

  return (
    <div>
      <PageHeader
        title="Reporting Hierarchy"
        description="Manage manager-subordinate relationships. Each user can have only one direct manager."
      />

      {/* Quick Guide */}
      {tree && tree.root.length > 0 && tree.root.length === users.filter(u => u.is_active).length && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Quick Start Guide</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Click &quot;Assign Manager&quot; on any user to assign them a manager</li>
            <li>Build your hierarchy: Top level (e.g., SUPER_ADMIN) → Middle level (e.g., MANAGING_DIRECTOR) → Lower levels</li>
            <li>Each user can have only ONE direct manager</li>
            <li>Users without managers appear at the top level (Level 0)</li>
            <li>Expand/collapse nodes using the arrow icons to view the full hierarchy</li>
          </ol>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {tree && tree.root.length > 0 ? (
          <div className="space-y-2">
            {tree.root.map((rootNode) => renderNode(rootNode, 0))}
          </div>
        ) : (
          <>
            <div className="text-center py-6 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No hierarchy defined yet.</p>
              <p className="text-sm mb-4">All users are currently at the top level (no managers assigned).</p>
            </div>
            
            {/* Show all users with Assign Manager buttons */}
            {users.filter((u) => u.is_active).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-3">All users (click &quot;Assign Manager&quot; to build hierarchy):</p>
                {users
                  .filter((u) => u.is_active)
                  .map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 py-3 px-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500 truncate">{user.email}</div>
                      </div>
                      <div className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                        L0
                      </div>
                      <Button
                        variant="secondary"
                        className="text-xs px-3 py-1.5 flex-shrink-0"
                        onClick={() => {
                          setSelectedUser(user);
                          setFormData({ subordinateId: user.id, managerId: '' });
                          setAssignModalOpen(true);
                        }}
                      >
                        Assign Manager
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Assign Manager Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setFormData({ subordinateId: '', managerId: '' });
          setSelectedUser(null);
        }}
        title="Assign Manager"
      >
        <form onSubmit={handleAssignManager} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Subordinate</label>
            <select
              value={formData.subordinateId}
              onChange={(e) => setFormData({ ...formData, subordinateId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              required
            >
              <option value="">Select a user</option>
              {users
                .filter((u) => u.is_active)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.email})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Manager</label>
            <select
              value={formData.managerId}
              onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              required
            >
              <option value="">Select a manager</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setAssignModalOpen(false);
                setFormData({ subordinateId: '', managerId: '' });
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Assign Manager
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove Manager Modal */}
      <Modal
        isOpen={removeModalOpen}
        onClose={() => {
          setRemoveModalOpen(false);
          setSelectedUser(null);
        }}
        title="Remove Manager"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to remove the manager relationship for{' '}
            <strong>
              {selectedUser?.first_name} {selectedUser?.last_name}
            </strong>
            ?
          </p>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setRemoveModalOpen(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemoveManager} loading={submitting}>
              Remove Manager
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

