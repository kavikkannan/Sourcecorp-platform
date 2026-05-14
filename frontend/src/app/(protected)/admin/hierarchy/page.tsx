'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  BarChart3,
  TrendingUp,
  CircleDot,
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
import { api } from '@/lib/api';

// ===================================================================
// CONSTANTS & STYLES
// ===================================================================

interface DepthStyle {
  bg: string;
  border: string;
  text: string;
  badge: string;
  line: string;
  avatarBg: string;
  avatarText: string;
}

const DEPTH_STYLES: Record<number, DepthStyle> = {
  0: {
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    line: '#fda4af',
    avatarBg: 'bg-rose-200',
    avatarText: 'text-rose-700',
  },
  1: {
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    text: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700',
    line: '#7dd3fc',
    avatarBg: 'bg-sky-200',
    avatarText: 'text-sky-700',
  },
  2: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    line: '#6ee7b7',
    avatarBg: 'bg-emerald-200',
    avatarText: 'text-emerald-700',
  },
  3: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    line: '#fcd34d',
    avatarBg: 'bg-amber-200',
    avatarText: 'text-amber-700',
  },
  4: {
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    line: '#c4b5fd',
    avatarBg: 'bg-violet-200',
    avatarText: 'text-violet-700',
  },
  5: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-300',
    text: 'text-cyan-700',
    badge: 'bg-cyan-100 text-cyan-700',
    line: '#67e8f9',
    avatarBg: 'bg-cyan-200',
    avatarText: 'text-cyan-700',
  },
};

function getDepthStyle(depth: number): DepthStyle {
  return DEPTH_STYLES[depth] || {
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-700',
    line: '#cbd5e1',
    avatarBg: 'bg-gray-200',
    avatarText: 'text-gray-700',
  };
}

// CSS connector lines — enhanced with depth-aware colors via inline style injection
function getConnectorStyles(depth: number): string {
  const style = getDepthStyle(depth);
  return `
    .oc-tree-d${depth} { display: flex; flex-direction: column; align-items: center; }
    .oc-children-d${depth} { display: flex; justify-content: center; padding-top: 28px; position: relative; }
    .oc-children-d${depth}::before {
      content: ''; position: absolute; top: 0; left: 50%; width: 0; height: 28px;
      border-left: 2px solid ${style.line}; border-radius: 1px;
    }
    .oc-branch-d${depth} { display: flex; flex-direction: column; align-items: center; position: relative; padding: 0 8px; }
    .oc-branch-d${depth}::before {
      content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 28px;
      border-top: 2px solid ${style.line}; border-radius: 1px;
    }
    .oc-branch-d${depth}:first-child::before { left: 50%; width: 50%; border-left: 2px solid ${style.line}; border-top-left-radius: 10px; }
    .oc-branch-d${depth}:last-child::before { width: 50%; border-right: 2px solid ${style.line}; border-top-right-radius: 10px; }
    .oc-branch-d${depth}:only-child::before { display: none; }
    .oc-branch-d${depth}::after {
      content: ''; position: absolute; top: 0; left: 50%; width: 0; height: 28px;
      border-left: 2px solid ${style.line}; border-radius: 1px;
    }
  `;
}

// ===================================================================
// HELPERS
// ===================================================================

function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName?.[0] || '').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}`;
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

function buildParentMap(nodes: HierarchyNode[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const walk = (list: HierarchyNode[], parentId: string | null) => {
    for (const node of list) {
      map.set(node.user.id, parentId);
      walk(node.subordinates, node.user.id);
    }
  };
  walk(nodes, null);
  return map;
}

function collectAncestorIds(nodeId: string, parentMap: Map<string, string | null>): string[] {
  const ancestors: string[] = [];
  let current: string | null = parentMap.get(nodeId) ?? null;
  while (current) {
    ancestors.push(current);
    current = parentMap.get(current) ?? null;
  }
  return ancestors;
}

// ===================================================================
// SUB-COMPONENTS
// ===================================================================

function StatCard({
  label,
  value,
  icon,
  colorClass,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function DepthLegend({ maxDepth }: { maxDepth: number }) {
  const levels = Array.from({ length: Math.min(maxDepth + 1, 6) }, (_, i) => i);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500 font-medium mr-1">Levels:</span>
      {levels.map((depth) => {
        const style = getDepthStyle(depth);
        return (
          <div key={depth} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-full ${style.avatarBg}`} />
            <span className="text-xs text-gray-600">L{depth}</span>
          </div>
        );
      })}
      {maxDepth > 5 && (
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-200" />
          <span className="text-xs text-gray-600">L6+</span>
        </div>
      )}
    </div>
  );
}


// ===================================================================
// NODE CARD
// ===================================================================

interface NodeCardProps {
  node: HierarchyNode;
  userRoles: Map<string, string[]>;
  isExpanded: boolean;
  hasChildren: boolean;
  isBatchMode: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  managerName: string | null;
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
  isHighlighted,
  managerName,
  onToggleExpand,
  onSelectForBatch,
  onAssign,
  onTransfer,
  onRemove,
  onHistory,
}: NodeCardProps) {
  const styles = getDepthStyle(node.depth);
  const roles = userRoles.get(node.user.id) ?? [];
  const subordinateCount = node.subordinates.length;

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        scale: isHighlighted ? 1.03 : 1,
        boxShadow: isHighlighted
          ? '0 0 0 3px rgba(59, 130, 246, 0.4), 0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`relative w-[240px] rounded-xl border-2 ${styles.border} ${styles.bg} shadow-sm hover:shadow-md transition-shadow p-3.5 inline-block align-top`}
    >
      {/* Highlight ring overlay */}
      {isHighlighted && (
        <div className="absolute -inset-0.5 rounded-xl bg-blue-400/20 animate-pulse pointer-events-none" />
      )}

      {/* Batch checkbox */}
      {isBatchMode && node.depth === 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectForBatch(node.user.id);
          }}
          className="absolute -top-2 -left-2 p-1 rounded-md bg-white border border-gray-300 shadow-sm hover:bg-gray-50 z-10"
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-primary-600" />
          ) : (
            <Square className="w-4 h-4 text-gray-400" />
          )}
        </button>
      )}

      {/* Subordinate count badge */}
      {subordinateCount > 0 && (
        <div className="absolute -top-2 -right-2 min-w-[22px] h-[22px] rounded-full bg-gray-800 text-white text-[10px] font-bold flex items-center justify-center px-1.5 shadow-sm z-10">
          {subordinateCount}
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar with initials */}
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${styles.avatarBg} ${styles.avatarText} text-sm font-bold`}
          title={`${node.user.first_name} ${node.user.last_name}`}
        >
          {getInitials(node.user.first_name, node.user.last_name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate text-sm leading-tight">
            {node.user.first_name} {node.user.last_name}
          </div>
          <div className="text-xs text-gray-500 truncate mt-0.5">{node.user.email}</div>

          {/* Manager name for non-root */}
          {managerName && (
            <div className="text-[10px] text-gray-400 mt-0.5 truncate">
              Reports to: <span className="text-gray-500">{managerName}</span>
            </div>
          )}

          {/* Roles */}
          {roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {roles.slice(0, 2).map((r) => (
                <span
                  key={r}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/80 border border-gray-200 text-gray-600 font-medium"
                >
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
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${styles.badge}`}>
              L{node.depth}
            </span>
            {node.user.is_active ? (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-green-100 text-green-700 font-medium flex items-center gap-1">
                <CircleDot className="w-2.5 h-2.5" />
                Active
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-medium flex items-center gap-1">
                <CircleDot className="w-2.5 h-2.5" />
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-gray-200/60">
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.user.id);
            }}
            className="p-1.5 rounded-lg hover:bg-white/80 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isExpanded ? (
                <motion.div
                  key="down"
                  initial={{ rotate: -90 }}
                  animate={{ rotate: 0 }}
                  exit={{ rotate: -90 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                </motion.div>
              ) : (
                <motion.div
                  key="right"
                  initial={{ rotate: 90 }}
                  animate={{ rotate: 0 }}
                  exit={{ rotate: 90 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </motion.div>
              )}
            </AnimatePresence>
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
    </motion.div>
  );
}


// ===================================================================
// RECURSIVE TREE RENDERER
// ===================================================================

interface OrgTreeProps {
  node: HierarchyNode;
  expandedNodes: Set<string>;
  visibleNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  userRoles: Map<string, string[]>;
  parentMap: Map<string, string | null>;
  managerNameMap: Map<string, string>;
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
  highlightedNodeIds,
  userRoles,
  parentMap,
  managerNameMap,
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

  if (!visibleNodeIds.has(node.user.id)) {
    return null;
  }

  const managerName = managerNameMap.get(node.user.id) || null;

  return (
    <div className={`oc-tree-d${node.depth}`}>
      <NodeCard
        node={node}
        userRoles={userRoles}
        isExpanded={isExpanded}
        hasChildren={hasChildren}
        isBatchMode={isBatchMode}
        isSelected={selectedIds.has(node.user.id)}
        isHighlighted={highlightedNodeIds.has(node.user.id)}
        managerName={node.depth > 0 ? 'Manager' : null} /* Simplified; full name lookup done in parent */
        onToggleExpand={onToggleExpand}
        onSelectForBatch={onSelectForBatch}
        onAssign={onAssign}
        onTransfer={onTransfer}
        onRemove={onRemove}
        onHistory={onHistory}
      />
      <AnimatePresence initial={false}>
        {isExpanded && visibleChildren.length > 0 && (
          <motion.div
            className={`oc-children-d${node.depth}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            {visibleChildren.map((sub, index) => (
              <motion.div
                key={sub.user.id}
                className={`oc-branch-d${node.depth}`}
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.04, duration: 0.25 }}
              >
                <OrgTree
                  node={sub}
                  expandedNodes={expandedNodes}
                  visibleNodeIds={visibleNodeIds}
                  highlightedNodeIds={highlightedNodeIds}
                  userRoles={userRoles}
                  parentMap={parentMap}
                  managerNameMap={managerNameMap}
                  isBatchMode={isBatchMode}
                  selectedIds={selectedIds}
                  onToggleExpand={onToggleExpand}
                  onSelectForBatch={onSelectForBatch}
                  onAssign={onAssign}
                  onTransfer={onTransfer}
                  onRemove={onRemove}
                  onHistory={onHistory}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===================================================================
// ZOOM / PAN CONTAINER
// ===================================================================

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onFullscreen,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen: () => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 shadow-sm p-1">
      <button
        onClick={onZoomOut}
        disabled={zoom <= 0.4}
        className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Zoom out"
      >
        <ZoomOut className="w-4 h-4 text-gray-600" />
      </button>
      <span className="text-xs font-mono text-gray-600 w-12 text-center select-none">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        disabled={zoom >= 2.5}
        className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Zoom in"
      >
        <ZoomIn className="w-4 h-4 text-gray-600" />
      </button>
      <div className="w-px h-5 bg-gray-200 mx-1" />
      <button
        onClick={onReset}
        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        title="Reset zoom"
      >
        <Minimize2 className="w-4 h-4 text-gray-600" />
      </button>
      <button
        onClick={onFullscreen}
        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        title="Toggle fullscreen"
      >
        <Maximize2 className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
}


// ===================================================================
// MAIN PAGE
// ===================================================================

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

  // Zoom & fullscreen
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Fetch data
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
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load hierarchy. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Build parent map and flattened nodes
  const { parentMap, allNodes } = useMemo(() => {
    if (!tree) {
      return { parentMap: new Map<string, string | null>(), allNodes: [] as HierarchyNode[] };
    }
    const flat = flattenTree(tree.root);
    const pmap = buildParentMap(tree.root);
    return { parentMap: pmap, allNodes: flat };
  }, [tree]);

  // Stats computation
  const stats = useMemo(() => {
    if (!tree || allNodes.length === 0) return null;
    const totalUsers = allNodes.length;
    const maxDepth = tree.maxDepth;
    const rootCount = tree.root.length;
    const activeCount = allNodes.filter((n) => n.user.is_active).length;
    const inactiveCount = totalUsers - activeCount;

    const managerCounts = allNodes
      .map((n) => ({ user: n.user, count: n.subordinates.length }))
      .filter((m) => m.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const avgDepth =
      totalUsers > 0
        ? (allNodes.reduce((sum, n) => sum + n.depth, 0) / totalUsers).toFixed(1)
        : '0';

    return { totalUsers, maxDepth, rootCount, activeCount, inactiveCount, managerCounts, avgDepth };
  }, [tree, allNodes]);

  // Search: compute visible nodes + highlighted nodes + auto-expand ancestors
  const { visibleNodeIds, highlightedNodeIds } = useMemo(() => {
    if (!tree) {
      return {
        visibleNodeIds: new Set<string>(),
        highlightedNodeIds: new Set<string>(),
      };
    }

    const all = allNodes;
    const baseVisible = new Set(all.map((n) => n.user.id));

    if (!searchQuery.trim()) {
      return {
        visibleNodeIds: baseVisible,
        highlightedNodeIds: new Set<string>(),
      };
    }

    const q = searchQuery.toLowerCase();

    // Find matching nodes
    const matched = all.filter((n) => {
      const name = `${n.user.first_name} ${n.user.last_name}`.toLowerCase();
      const email = n.user.email.toLowerCase();
      const roles = (userRoles.get(n.user.id) ?? []).join(' ').toLowerCase();
      return name.includes(q) || email.includes(q) || roles.includes(q);
    });

    // Build visible set: matches + all their ancestors
    const visible = new Set<string>();
    const highlighted = new Set<string>();

    for (const node of matched) {
      highlighted.add(node.user.id);
      visible.add(node.user.id);
      let pid = parentMap.get(node.user.id) ?? null;
      while (pid) {
        visible.add(pid);
        pid = parentMap.get(pid) ?? null;
      }
    }

    return { visibleNodeIds: visible, highlightedNodeIds: highlighted };
  }, [tree, allNodes, searchQuery, userRoles, parentMap]);

  // Auto-expand ancestors when searching
  useEffect(() => {
    if (searchQuery.trim() && tree && highlightedNodeIds.size > 0) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        for (const nodeId of highlightedNodeIds) {
          let pid = parentMap.get(nodeId) ?? null;
          while (pid) {
            next.add(pid);
            pid = parentMap.get(pid) ?? null;
          }
        }
        return next;
      });
    }
  }, [searchQuery, tree, highlightedNodeIds, parentMap]);

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
      toast.success('Manager assigned successfully');
      setAssignModalOpen(false);
      setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to assign manager');
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
      toast.success('Manager transferred successfully');
      setTransferModalOpen(false);
      setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to transfer manager');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveManager = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await hierarchyService.removeManager({ subordinateId: selectedUser.id });
      toast.success('Manager relationship removed');
      setRemoveModalOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to remove manager');
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
      toast.success(msg);
      setBatchModalOpen(false);
      setSelectedIds(new Set());
      setIsBatchMode(false);
      setFormData({ subordinateId: '', managerId: '', newManagerId: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to batch assign');
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
      toast.error(error.response?.data?.error || 'Failed to load history');
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
    toast.success('Hierarchy exported to CSV');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      treeContainerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Zoom handlers
  const zoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.5));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.4));
  const resetZoom = () => setZoom(1);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Build manager name lookup for all nodes
  const managerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!tree) return map;
    for (const node of allNodes) {
      const mid = parentMap.get(node.user.id);
      if (mid) {
        const mgr = allNodes.find((n) => n.user.id === mid);
        if (mgr) {
          map.set(node.user.id, `${mgr.user.first_name} ${mgr.user.last_name}`);
        }
      }
    }
    return map;
  }, [tree, allNodes, parentMap]);

  // Generate connector styles for all depth levels present
  const connectorStyles = useMemo(() => {
    if (!tree) return '';
    const levels = new Set<number>();
    allNodes.forEach((n) => levels.add(n.depth));
    return Array.from(levels)
      .map((d) => getConnectorStyles(d))
      .join('\n');
  }, [tree, allNodes]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading hierarchy...</p>
      </div>
    );
  }

  const availableUsers = users.filter((u) => u.id !== formData.subordinateId && u.is_active);
  const rootUsers = users.filter((u) => u.is_active);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: connectorStyles }} />

      <PageHeader
        title="Reporting Hierarchy"
        description="Visualize and manage manager-subordinate relationships."
        action={
          <div className="flex items-center gap-2 flex-wrap">
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
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={exportHierarchy}>
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

      {/* Stats Panel */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard
            label="Total Users"
            value={stats.totalUsers}
            icon={<Users className="w-4 h-4 text-blue-600" />}
            colorClass="bg-blue-50"
          />
          <StatCard
            label="Max Depth"
            value={stats.maxDepth}
            icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
            colorClass="bg-emerald-50"
          />
          <StatCard
            label="Root Nodes"
            value={stats.rootCount}
            icon={<BarChart3 className="w-4 h-4 text-amber-600" />}
            colorClass="bg-amber-50"
          />
          <StatCard
            label="Active"
            value={stats.activeCount}
            icon={<CircleDot className="w-4 h-4 text-green-600" />}
            colorClass="bg-green-50"
          />
          <StatCard
            label="Inactive"
            value={stats.inactiveCount}
            icon={<CircleDot className="w-4 h-4 text-red-600" />}
            colorClass="bg-red-50"
          />
          <StatCard
            label="Avg Depth"
            value={stats.avgDepth}
            icon={<TrendingUp className="w-4 h-4 text-violet-600" />}
            colorClass="bg-violet-50"
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-shadow"
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

        <ZoomControls
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
          onFullscreen={toggleFullscreen}
        />

        {tree && <DepthLegend maxDepth={tree.maxDepth} />}

        {searchQuery && (
          <div className="text-sm text-gray-500">
            {highlightedNodeIds.size} match{highlightedNodeIds.size !== 1 ? 'es' : ''} in {visibleNodeIds.size} node{visibleNodeIds.size !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Org Chart */}
      <div
        ref={treeContainerRef}
        className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto relative ${
          isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
        }`}
        style={{ minHeight: isFullscreen ? '100vh' : '500px' }}
      >
        <div
          className="p-8 origin-top-center transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
          }}
        >
          {tree && tree.root.length > 0 ? (
            <div className="space-y-20">
              {tree.root.map((rootNode) => (
                <div key={rootNode.user.id} className="flex justify-center">
                  <OrgTree
                    node={rootNode}
                    expandedNodes={expandedNodes}
                    visibleNodeIds={visibleNodeIds}
                    highlightedNodeIds={highlightedNodeIds}
                    userRoles={userRoles}
                    parentMap={parentMap}
                    managerNameMap={managerNameMap}
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
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">No hierarchy defined yet.</p>
              <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
                All users are at the top level. Start building your organization by assigning managers to users.
              </p>
              {rootUsers.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
                  {rootUsers.map((user) => (
                    <motion.div
                      key={user.id}
                      whileHover={{ scale: 1.02 }}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedUser(user);
                        setFormData({ subordinateId: user.id, managerId: '', newManagerId: '' });
                        setAssignModalOpen(true);
                      }}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-primary-700 font-bold text-sm">
                        {getInitials(user.first_name, user.last_name)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                      </div>
                      <Button variant="secondary" className="text-xs px-2 py-1 flex-shrink-0">
                        Assign
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
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
            <div className="flex flex-col items-center py-8 text-gray-500 gap-3">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
              <span className="text-sm">Loading history...</span>
            </div>
          ) : historyData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No history found for this user.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {historyData.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200"
                >
                  <div
                    className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      entry.change_type === 'ASSIGN'
                        ? 'bg-green-500'
                        : entry.change_type === 'REMOVE'
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {entry.change_type === 'ASSIGN' &&
                        `Assigned to ${entry.new_manager_first_name || 'Unknown'} ${entry.new_manager_last_name || ''}`}
                      {entry.change_type === 'REMOVE' &&
                        `Removed from ${entry.old_manager_first_name || 'Unknown'} ${entry.old_manager_last_name || ''}`}
                      {entry.change_type === 'TRANSFER' &&
                        `Transferred from ${entry.old_manager_first_name || 'Unknown'} ${entry.old_manager_last_name || ''} to ${entry.new_manager_first_name || 'Unknown'} ${entry.new_manager_last_name || ''}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      entry.change_type === 'ASSIGN'
                        ? 'bg-green-100 text-green-700'
                        : entry.change_type === 'REMOVE'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {entry.change_type}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
