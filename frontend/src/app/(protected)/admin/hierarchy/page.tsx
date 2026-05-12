'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Download,
  Expand,
  Minimize2,
  History,
  ArrowRightLeft,
  CheckSquare,
  Square,
  UserCheck,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import {
  hierarchyService,
  User,
  HierarchyNode,
  HierarchyHistoryEntry,
} from '@/lib/hierarchy';
import api from '@/lib/api';

// ------------------------------------------------------------------
// CSS Overrides for react-organizational-chart
// ------------------------------------------------------------------
const orgChartStyles = `
  .oc-tree { display: flex; flex-direction: column; align-items: center; }
  .oc-children { display: flex; justify-content: center; padding-top: 24px; position: relative; }
  .oc-children::before {
    content: ''; position: absolute; top: 0; left: 50%; width: 0; height: 24px;
    border-left: 1.5px solid #94a3b8;
  }
  .oc-branch { display: flex; flex-direction: column; align-items: center; position: relative; padding: 0 6px; }
  .oc-branch::before {
    content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 24px;
    border-top: 1.5px solid #94a3b8;
  }
  .oc-branch:first-child::before { left: 50%; width: 50%; border-left: 1.5px solid #94a3b8; border-top-left-radius: 8px; }
  .oc-branch:last-child::before { width: 50%; border-right: 1.5px solid #94a3b8; border-top-right-radius: 8px; }
  .oc-branch:only-child::before { display: none; }
  .oc-branch::after {
    content: ''; position: absolute; top: 0; left: 50%; width: 0; height: 24px;
    border-left: 1.5px solid #94a3b8;
  }
`; 

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getDepthStyles(depth: number) {
  const map: Record<number, { bg: string; border: string; text: string; badge: string }> = {
    0: { bg: 'bg-primary-50', border: 'border-primary-300', text: 'text-primary-700', badge: 'bg-primary-100 text-primary-700' },
    1: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    2: { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
    3: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  };
  return map[depth] || { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700' };
}

function flattenTree(nodes: HierarchyNode[]): HierarchyNode[] {
  const result: HierarchyNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.subordinates?.length) {
      result.push(...flattenTree(node.subordinates));
    }
  }
  return result;
}

function collectAncestorIds(node: HierarchyNode, map: Map<string, string | null>): string[] {
  const ancestors: string[] = [];
  let current: string | null = map.get(node.user.id) ?? null;
  while (current) {
    ancestors.push(current);
    current = map.get(current) ?? null;
  }
  return ancestors;
}

// ------------------------------------------------------------------
// Node Card Component
// ------------------------------------------------------------------

interface NodeCardProps {
  node: HierarchyNode;
  userRoles: Map<string, string[]>;
  isExpanded: boolean;
  hasChildren: boolean;
  isBatchMode: boolean;
  isSelected: boolean;
  onToggleExpand: (id: string) => void;
  onSelectForBatch: (id: string) => void;
  onAssign: (user: User) => void;
  onTransfer: (user: User) => void;
  onRemove: (user: User) => void;
  onHistory: (user: User) => void;
}

function NodeCard({
  node,
  userRoles,
  isExpanded,
  hasChildren,
  isBatchMode,
  isSelected,
  onToggleExpand,
  onSelectForBatch,
  onAssign,
  onTransfer,
  onRemove,
  onHistory,
}: NodeCardProps) {
  const styles = getDepthStyles(node.depth);
  const roles = userRoles.get(node.user.id) ?? [];

  return (
    <div
      className={`relative w-[220px] rounded-xl border-2 ${styles.border} ${styles.bg} shadow-sm hover:shadow-md transition-shadow p-3 inline-block align-top`}
    >
      {/* Batch checkbox */}
      {isBatchMode && node.depth === 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectForBatch(node.user.id);
          }}
          className="absolute -top-2 -left-2 p-1 rounded bg-white border border-gray-300 shadow-sm hover:bg-gray-50"
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-primary-600" />
          ) : (
            <Square className="w-4 h-4 text-gray-400" />
          )}
        </button>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${styles.bg.replace('50', '200')}`}>
          <Users className={`w-5 h-5 ${styles.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate text-sm">
            {node.user.first_name} {node.user.last_name}
          </div>
          <div className="text-xs text-gray-500 truncate">{node.user.email}</div>

          {/* Roles */}
          {roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {roles.slice(0, 2).map((r) => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/80 border border-gray-200 text-gray-600 font-medium">
                  {r}
                </span>
              ))}
              {roles.length > 2 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/80 border border-gray-200 text-gray-500">
                  +{roles.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Badges row */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${styles.badge}`}>
              L{node.depth}
            </span>
            {node.user.is_active ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                Active
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-200/60">
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.user.id);
            }}
            className="p-1.5 rounded-lg hover:bg-white/80 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            )}
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            onHistory(node.user);
          }}
          className="p-1.5 rounded-lg hover:bg-white/80 transition-colors"
          title="View History"
        >
          <History className="w-3.5 h-3.5 text-gray-500" />
        </button>

        {node.depth > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTransfer(node.user);
            }}
            className="p-1.5 rounded-lg hover:bg-white/80 transition-colors"
            title="Transfer Manager"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssign(node.user);
            }}
            className="p-1.5 rounded-lg hover:bg-white/80 transition-colors"
            title="Assign Manager"
          >
            <UserCheck className="w-3.5 h-3.5 text-primary-600" />
          </button>
        )}

        {node.depth > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(node.user);
            }}
            className="p-1.5 rounded-lg hover:bg-white/80 transition-colors"
            title="Remove Manager"
          >
            <X className="w-3.5 h-3.5 text-red-500" />
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Recursive Tree Renderer
// ------------------------------------------------------------------

interface OrgTreeProps {
  node: HierarchyNode;
  expandedNodes: Set<string>;
  visibleNodeIds: Set<string>;
  userRoles: Map<string, string[]>;
  isBatchMode: boolean;
  selectedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectForBatch: (id: string) => void;
  onAssign: (user: User) => void;
  onTransfer: (user: User) => void;
  onRemove: (user: User) => void;
  onHistory: (user: User) => void;
}

function OrgTree({
  node,
  expandedNodes,
  visibleNodeIds,
  userRoles,
  isBatchMode,
  selectedIds,
  onToggleExpand,
  onSelectForBatch,
  onAssign,
  onTransfer,
  onRemove,
  onHistory,
}: OrgTreeProps) {
  const isExpanded = expandedNodes.has(node.user.id);
  const hasChildren = node.subordinates.length > 0;
  const visibleChildren = node.subordinates.filter((sub) => visibleNodeIds.has(sub.user.id));

  // If this node itself isn't visible, skip rendering it entirely
  if (!visibleNodeIds.has(node.user.id)) {
    return null;
  }

  return (
    <div className="oc-tree">
      <NodeCard
        node={node}
        userRoles={userRoles}
        isExpanded={isExpanded}
        hasChildren={hasChildren}
        isBatchMode={isBatchMode}
        isSelected={selectedIds.has(node.user.id)}
        onToggleExpand={onToggleExpand}
        onSelectForBatch={onSelectForBatch}
        onAssign={onAssign}
        onTransfer={onTransfer}
        onRemove={onRemove}
        onHistory={onHistory}
      />
      {isExpanded && visibleChildren.length > 0 && (
        <div className="oc-children">
          {visibleChildren.map((sub) => (
            <div key={sub.user.id} className="oc-branch">
              <OrgTree
                node={sub}
                expandedNodes={expandedNodes}
                visibleNodeIds={visibleNodeIds}
                userRoles={userRoles}
                isBatchMode={isBatchMode}
                selectedIds={selectedIds}
                onToggleExpand={onToggleExpand}
                onSelectForBatch={onSelectForBatch}
                onAssign={onAssign}
                onTransfer={onTransfer}
                onRemove={onRemove}
                onHistory={onHistory}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Main Page
// ------------------------------------------------------------------

export default function HierarchyPage() {
  const [tree, setTree] = useState<{ root: HierarchyNode[]; maxDepth: number } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ subordinateId: '', managerId: '', newManagerId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [historyData, setHistoryData] = useState<HierarchyHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Tree state
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [treeResponse, usersResponse, rolesResponse] = await Promise.all([
        hierarchyService.getHierarchyTree(),
        api.get('/admin/users'),
        api.get('/admin/roles'),
      ]);
      setTree(treeResponse);

      // Normalize users
      const usersData = (Array.isArray(usersResponse.data)
        ? usersResponse.data
        : usersResponse.data.users || usersResponse.data.data || []
      ).map((user: any) => ({
        id: user.id,
        email: user.email,
        first_name: user.firstName || user.first_name,
        last_name: user.lastName || user.last_name,
        is_active: user.isActive !== undefined ? user.isActive : user.is_active,
        created_at: user.createdAt || user.created_at,
        updated_at: user.updatedAt || user.updated_at,
      }));
      setUsers(usersData);

      // Build user -> roles map
      const rolesMap = new Map<string, string[]>();
      const allRoles = Array.isArray(rolesResponse.data)
        ? rolesResponse.data
        : rolesResponse.data.roles || [];
      for (const user of usersData) {
        const roles: string[] = user.roles || user.roleIds || [];
        // Try to resolve role names if we have IDs
        const roleNames = roles
          .map((r: string) => {
            const found = allRoles.find((ar: any) => ar.id === r || ar.name === r);
            return found ? found.name : r;
          })
          .filter(Boolean);
        rolesMap.set(user.id, roleNames);
      }
      setUserRoles(rolesMap);

      // Auto-expand root nodes
      const rootIds = new Set<string>();
      treeResponse.root.forEach((r: HierarchyNode) => rootIds.add(r.user.id));
      setExpandedNodes(rootIds);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      alert('Failed to load hierarchy. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Compute visible nodes based on search
  const visibleNodeIds = useMemo(() => {
    if (!tree) return new Set<string>();
    if (!searchQuery.trim()) {
      return new Set(flattenTree(tree.root).map((n) => n.user.id));
    }

    const q = searchQuery.toLowerCase();
    const allNodes = flattenTree(tree.root);

    // Build child -> parent map
    const parentMap = new Map<string, string | null>();
    const buildParentMap = (nodes: HierarchyNode[], parentId: string | null) => {
      for (const node of nodes) {
        parentMap.set(node.user.id, parentId);
        buildParentMap(node.subordinates, node.user.id);
      }
    };
    buildParentMap(tree.root, null);

    // Find matching nodes
    const matched = allNodes.filter((n) => {
      const name = `${n.user.first_name} ${n.user.last_name}`.toLowerCase();
      const email = n.user.email.toLowerCase();
      const roles = (userRoles.get(n.user.id) ?? []).join(' ').toLowerCase();
      return name.includes(q) || email.includes(q) || roles.includes(q);
    });

    // Include all ancestors of matched nodes
    const visible = new Set<string>();
    for (const node of matched) {
      visible.add(node.user.id);
      let pid = parentMap.get(node.user.id) ?? null;
      while (pid) {
        visible.add(pid);
        pid = parentMap.get(pid) ?? null;
      }
    }
    return visible;
  }, [tree, searchQuery, userRoles]);

  const toggleNode = useCallback((userId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!tree) return;
    setExpandedNodes(new Set(flattenTree(tree.root).map((n) => n.user.id)));
  }, [tree]);

  const collapseAll = useCallback(() => {
    if (!tree) return;
    const roots = new Set(tree.root.map((r) => r.user.id));
    setExpandedNodes(roots);
  }, [tree]);

  const handleAssignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await hierarchyService.assignManager({
        subordinateId: formData.subordinateId,
        managerId: formData.managerId,
      });
      setAssignModalOpen(false);
      setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign manager');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await hierarchyService.transferManager({
        subordinateId: formData.subordinateId,
        newManagerId: formData.newManagerId,
      });
      setTransferModalOpen(false);
      setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to transfer manager');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveManager = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await hierarchyService.removeManager({ subordinateId: selectedUser.id });
      setRemoveModalOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove manager');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0 || !formData.managerId) return;
    setSubmitting(true);
    try {
      const result = await hierarchyService.batchAssignManager({
        subordinateIds: Array.from(selectedIds),
        managerId: formData.managerId,
      });
      const msg = `Assigned ${result.succeeded.length} successfully.${result.failed.length > 0 ? ` ${result.failed.length} failed.` : ''}`;
      alert(msg);
      setBatchModalOpen(false);
      setSelectedIds(new Set());
      setIsBatchMode(false);
      setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to batch assign');
    } finally {
      setSubmitting(false);
    }
  };

  const loadHistory = async (user: User) => {
    setSelectedUser(user);
    setHistoryLoading(true);
    try {
      const data = await hierarchyService.getHierarchyHistory(user.id);
      setHistoryData(data);
      setHistoryModalOpen(true);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportHierarchy = () => {
    if (!tree) return;
    const flat = flattenTree(tree.root);
    const rows = flat.map((n) => ({
      id: n.user.id,
      name: `${n.user.first_name} ${n.user.last_name}`,
      email: n.user.email,
      level: n.depth,
      status: n.user.is_active ? 'Active' : 'Inactive',
      roles: (userRoles.get(n.user.id) ?? []).join(', '),
      manager_id: n.depth > 0 ? '' : '', // We don't have direct access from flattened view
    }));

    const csv = [
      ['ID', 'Name', 'Email', 'Level', 'Status', 'Roles'].join(','),
      ...rows.map((r) =>
        [r.id, `"${r.name}"`, r.email, r.level, r.status, `"${r.roles}"`].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hierarchy-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading hierarchy...</div>
      </div>
    );
  }

  const availableUsers = users.filter((u) => u.id !== formData.subordinateId && u.is_active);
  const rootUsers = users.filter((u) => u.is_active);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: orgChartStyles }} />
      <PageHeader
        title="Reporting Hierarchy"
        description="Visualize and manage manager-subordinate relationships."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={isBatchMode ? 'primary' : 'secondary'}
              icon={<CheckSquare className="w-4 h-4" />}
              onClick={() => {
                setIsBatchMode((p) => !p);
                setSelectedIds(new Set());
              }}
            >
              {isBatchMode ? 'Exit Batch' : 'Batch Select'}
            </Button>
            {isBatchMode && selectedIds.size > 0 && (
              <Button
                variant="primary"
                icon={<UserCheck className="w-4 h-4" />}
                onClick={() => {
                  setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
                  setBatchModalOpen(true);
                }}
              >
                Assign {selectedIds.size} to Manager
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={exportHierarchy}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => {
                setLoading(true);
                fetchData();
              }}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="text-xs px-3 py-2" icon={<Expand className="w-3.5 h-3.5" />} onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="secondary" className="text-xs px-3 py-2" icon={<Minimize2 className="w-3.5 h-3.5" />} onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
        {searchQuery && (
          <div className="text-sm text-gray-500">
            {visibleNodeIds.size} result(s)
          </div>
        )}
      </div>

      {/* Org Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 overflow-x-auto">
        {tree && tree.root.length > 0 ? (
          <div className="space-y-16">
            {tree.root.map((rootNode) => (
              <div key={rootNode.user.id} className="flex justify-center">
                <OrgTree
                  node={rootNode}
                  expandedNodes={expandedNodes}
                  visibleNodeIds={visibleNodeIds}
                  userRoles={userRoles}
                  isBatchMode={isBatchMode}
                  selectedIds={selectedIds}
                  onToggleExpand={toggleNode}
                  onSelectForBatch={toggleSelect}
                  onAssign={(user) => {
                    setSelectedUser(user);
                    setFormData({ subordinateId: user.id, managerId: '', newManagerId: '' });
                    setAssignModalOpen(true);
                  }}
                  onTransfer={(user) => {
                    setSelectedUser(user);
                    setFormData({ subordinateId: user.id, managerId: '', newManagerId: '' });
                    setTransferModalOpen(true);
                  }}
                  onRemove={(user) => {
                    setSelectedUser(user);
                    setRemoveModalOpen(true);
                  }}
                  onHistory={loadHistory}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">No hierarchy defined yet.</p>
            <p className="text-sm text-gray-500 mb-6">All users are at the top level. Start building by assigning managers.</p>
            {rootUsers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
                {rootUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    <Button
                      variant="secondary"
                      className="text-xs px-2 py-1 flex-shrink-0"
                      onClick={() => {
                        setSelectedUser(user);
                        setFormData({ subordinateId: user.id, managerId: '', newManagerId: '' });
                        setAssignModalOpen(true);
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign Manager Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
            >
              <option value="">Select a user</option>
              {rootUsers.map((user) => (
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
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
                setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
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

      {/* Transfer Manager Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false);
          setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
          setSelectedUser(null);
        }}
        title="Transfer to New Manager"
      >
        <form onSubmit={handleTransferManager} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            This will move <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong> from their current manager to a new one.
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Subordinate</label>
            <select
              value={formData.subordinateId}
              onChange={(e) => setFormData({ ...formData, subordinateId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
            >
              <option value="">Select a user</option>
              {rootUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">New Manager</label>
            <select
              value={formData.newManagerId}
              onChange={(e) => setFormData({ ...formData, newManagerId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
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
                setTransferModalOpen(false);
                setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Transfer
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
            <Button variant="secondary" onClick={() => { setRemoveModalOpen(false); setSelectedUser(null); }}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemoveManager} loading={submitting}>
              Remove Manager
            </Button>
          </div>
        </div>
      </Modal>

      {/* Batch Assign Modal */}
      <Modal
        isOpen={batchModalOpen}
        onClose={() => {
          setBatchModalOpen(false);
          setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
        }}
        title={`Assign ${selectedIds.size} Users to Manager`}
      >
        <form onSubmit={handleBatchAssign} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            {selectedIds.size} user(s) selected. Choose a manager to assign them all to.
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Manager</label>
            <select
              value={formData.managerId}
              onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
            >
              <option value="">Select a manager</option>
              {users.filter((u) => u.is_active).map((user) => (
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
                setBatchModalOpen(false);
                setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Assign All
            </Button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
          setHistoryData([]);
          setSelectedUser(null);
        }}
        title={`History: ${selectedUser?.first_name} ${selectedUser?.last_name}`}
      >
        <div className="space-y-3">
          {historyLoading ? (
            <div className="text-center py-8 text-gray-500">Loading history...</div>
          ) : historyData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No history found for this user.</div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {historyData.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    entry.change_type === 'ASSIGN' ? 'bg-green-500' :
                    entry.change_type === 'REMOVE' ? 'bg-red-500' :
                    'bg-amber-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {entry.change_type === 'ASSIGN' && `Assigned to ${entry.new_manager_first_name} ${entry.new_manager_last_name}`}
                      {entry.change_type === 'REMOVE' && `Removed from ${entry.old_manager_first_name} ${entry.old_manager_last_name}`}
                      {entry.change_type === 'TRANSFER' && `Transferred from ${entry.old_manager_first_name} ${entry.old_manager_last_name} to ${entry.new_manager_first_name} ${entry.new_manager_last_name}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    entry.change_type === 'ASSIGN' ? 'bg-green-100 text-green-700' :
                    entry.change_type === 'REMOVE' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {entry.change_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
