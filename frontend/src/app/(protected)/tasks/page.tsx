'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  X,
  MessageSquare,
  Calendar,
  Briefcase,
  Search,
  LayoutGrid,
  List,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ArrowRight,
  TrendingUp,
  Zap,
  Filter,
  ChevronDown,
  Trash2,
  Send,
  Activity,
  BarChart3,
  RotateCcw,
  Flag,
  User,
  Tag,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import {
  taskService,
  Task,
  TaskComment,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_TYPES,
  getStatusColor,
  getStatusLabel,
  getPriorityColor,
  getPriorityLabel,
  getTaskTypeColor,
  getTaskTypeLabel,
} from '@/lib/tasks';
import { useAuth } from '@/contexts/AuthContext';
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';

// ===================================================================
// TYPES
// ===================================================================

type ViewMode = 'kanban' | 'list';
type SortOption = 'dueDate' | 'priority' | 'created';

interface Filters {
  status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  taskType?: 'PERSONAL' | 'COMMON' | 'HIERARCHICAL';
}

interface TaskAnalytics {
  total: number;
  byStatus: { OPEN: number; IN_PROGRESS: number; COMPLETED: number };
  byPriority: { LOW: number; MEDIUM: number; HIGH: number };
  overdue: number;
  completedToday: number;
  completedThisWeek: number;
  highPriorityOpen: number;
}

interface TaskActivity {
  id: string;
  action: string;
  userId: string | null;
  userName: string | null;
  details: any;
  createdAt: string;
}

// ===================================================================
// HELPERS
// ===================================================================

function getDueDateBadge(dueDate: string | null, status: string) {
  if (!dueDate || status === 'COMPLETED') return null;
  const date = new Date(dueDate);
  if (isPast(date) && !isToday(date)) {
    return { text: `${Math.abs(differenceInDays(date, new Date()))}d overdue`, color: 'text-red-600 bg-red-50 border-red-200' };
  }
  if (isToday(date)) return { text: 'Due today', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  if (isTomorrow(date)) return { text: 'Due tomorrow', color: 'text-blue-600 bg-blue-50 border-blue-200' };
  if (differenceInDays(date, new Date()) <= 3) return { text: `Due in ${differenceInDays(date, new Date())}d`, color: 'text-slate-600 bg-slate-100 border-slate-200' };
  return { text: format(date, 'MMM d'), color: 'text-slate-500 bg-slate-50 border-slate-200' };
}

function getPriorityDot(priority: string) {
  const colors: Record<string, string> = {
    HIGH: 'bg-red-500',
    MEDIUM: 'bg-amber-500',
    LOW: 'bg-slate-300',
  };
  return colors[priority] || 'bg-slate-300';
}

function getInitials(firstName?: string, lastName?: string) {
  return `${(firstName?.[0] || '').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}`;
}

function formatActivityAction(action: string): string {
  const map: Record<string, string> = {
    'task.create': 'created this task',
    'task.status.update': 'updated status',
    'task.comment.add': 'added a comment',
    'task.delete': 'deleted this task',
  };
  return map[action] || action;
}

// ===================================================================
// ANALYTICS HEADER
// ===================================================================

function AnalyticsHeader({ analytics, loading }: { analytics: TaskAnalytics | null; loading: boolean }) {
  if (loading || !analytics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Tasks', value: analytics.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
    { label: 'In Progress', value: analytics.byStatus.IN_PROGRESS, icon: Zap, color: 'bg-amber-50 text-amber-600' },
    { label: 'Completed', value: analytics.byStatus.COMPLETED, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Overdue', value: analytics.overdue, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { label: 'High Priority', value: analytics.highPriorityOpen, icon: Flag, color: 'bg-rose-50 text-rose-600' },
    { label: 'Done Today', value: analytics.completedToday, icon: TrendingUp, color: 'bg-violet-50 text-violet-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center gap-3"
        >
          <div className={`w-9 h-9 rounded-lg ${card.color} flex items-center justify-center flex-shrink-0`}>
            <card.icon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 leading-tight">{card.value}</div>
            <div className="text-[11px] text-slate-500 font-medium">{card.label}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ===================================================================
// FILTER BAR
// ===================================================================

function FilterBar({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  resultCount,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filters: Filters;
  onFilterChange: (f: Filters) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  resultCount: number;
}) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-5">
      <div className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            showFilters || Object.keys(filters).length > 0
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {Object.keys(filters).length > 0 && (
            <span className="ml-0.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">
              {Object.keys(filters).length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('kanban')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium">{resultCount} task{resultCount !== 1 ? 's' : ''}</span>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
              <select
                value={filters.status || ''}
                onChange={(e) => onFilterChange({ ...filters, status: (e.target.value as any) || undefined })}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">All Statuses</option>
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={filters.priority || ''}
                onChange={(e) => onFilterChange({ ...filters, priority: (e.target.value as any) || undefined })}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">All Priorities</option>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <select
                value={filters.taskType || ''}
                onChange={(e) => onFilterChange({ ...filters, taskType: (e.target.value as any) || undefined })}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">All Types</option>
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as SortOption)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="dueDate">Sort by Due Date</option>
                <option value="priority">Sort by Priority</option>
                <option value="created">Sort by Created</option>
              </select>
              {Object.keys(filters).length > 0 && (
                <button
                  onClick={() => onFilterChange({})}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ===================================================================
// TASK CARD
// ===================================================================

function TaskCard({
  task,
  onClick,
  onStatusChange,
  isUpdating,
}: {
  task: Task;
  onClick: () => void;
  onStatusChange: (taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED') => void;
  isUpdating: boolean;
}) {
  const dueBadge = getDueDateBadge(task.due_date, task.status);
  const assignee = task.assignee;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px -8px rgba(0,0,0,0.12)' }}
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer shadow-sm hover:border-slate-300 transition-colors group"
    >
      {/* Top row: type + priority */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getTaskTypeColor(task.task_type)}`}>
            {getTaskTypeLabel(task.task_type)}
          </span>
          {dueBadge && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${dueBadge.color}`}>
              {dueBadge.text}
            </span>
          )}
        </div>
        <div className={`w-2 h-2 rounded-full ${getPriorityDot(task.priority)}`} title={getPriorityLabel(task.priority)} />
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-slate-900 mb-1.5 line-clamp-2 group-hover:text-blue-700 transition-colors">
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {/* Assignee avatar */}
          {assignee ? (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-[9px] font-bold text-white" title={`${assignee.first_name} ${assignee.last_name}`}>
              {getInitials(assignee.first_name, assignee.last_name)}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="w-3 h-3 text-slate-400" />
            </div>
          )}

          {/* Linked case */}
          {task.linked_case && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Briefcase className="w-3 h-3" />
              {task.linked_case.case_number}
            </span>
          )}

          {/* Comments count indicator (if we had it) */}
        </div>

        {/* Quick action */}
        {task.status !== 'COMPLETED' && (
          <div onClick={(e) => e.stopPropagation()}>
            {task.status === 'OPEN' && (
              <button
                onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}
                disabled={isUpdating}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition-colors disabled:opacity-50"
              >
                {isUpdating ? '...' : 'Start'}
              </button>
            )}
            {task.status === 'IN_PROGRESS' && (
              <button
                onClick={() => onStatusChange(task.id, 'COMPLETED')}
                disabled={isUpdating}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
              >
                {isUpdating ? '...' : 'Complete'}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ===================================================================
// KANBAN COLUMN
// ===================================================================

const COLUMN_CONFIG: { id: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'; title: string; color: string; bg: string; icon: React.ElementType }[] = [
  { id: 'OPEN', title: 'To Do', color: 'border-t-blue-500', bg: 'bg-slate-50/70', icon: Circle },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-t-amber-500', bg: 'bg-slate-50/70', icon: Zap },
  { id: 'COMPLETED', title: 'Done', color: 'border-t-emerald-500', bg: 'bg-slate-50/70', icon: CheckCircle2 },
];

function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onStatusChange,
  updatingTaskId,
}: {
  column: (typeof COLUMN_CONFIG)[0];
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED') => void;
  updatingTaskId: string | null;
}) {
  return (
    <div className={`flex flex-col rounded-xl border border-slate-200 border-t-4 ${column.color} ${column.bg} min-h-[400px]`}>
      {/* Column header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200/60">
        <div className="flex items-center gap-2">
          <column.icon className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">{column.title}</h3>
          <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded-full border border-slate-200">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Tasks */}
      <div className="p-2.5 space-y-2.5 flex-1">
        <AnimatePresence mode="popLayout">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onStatusChange={onStatusChange}
              isUpdating={updatingTaskId === task.id}
            />
          ))}
        </AnimatePresence>

        {tasks.length === 0 && (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2">
              <column.icon className="w-4 h-4 text-slate-300" />
            </div>
            <p className="text-xs text-slate-400">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================================================================
// KANBAN BOARD
// ===================================================================

function KanbanBoard({
  tasks,
  onTaskClick,
  onStatusChange,
  updatingTaskId,
}: {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED') => void;
  updatingTaskId: string | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMN_CONFIG.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          tasks={tasks.filter((t) => t.status === column.id)}
          onTaskClick={onTaskClick}
          onStatusChange={onStatusChange}
          updatingTaskId={updatingTaskId}
        />
      ))}
    </div>
  );
}

// ===================================================================
// LIST VIEW
// ===================================================================

function ListView({
  tasks,
  onTaskClick,
  onStatusChange,
  updatingTaskId,
}: {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED') => void;
  updatingTaskId: string | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500">No tasks found.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {tasks.map((task) => {
            const dueBadge = getDueDateBadge(task.due_date, task.status);
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 hover:bg-slate-50 cursor-pointer flex items-center gap-4 group"
                onClick={() => onTaskClick(task)}
              >
                {/* Priority dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityDot(task.priority)}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                      {task.title}
                    </h4>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${getTaskTypeColor(task.task_type)}`}>
                      {getTaskTypeLabel(task.task_type)}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${getStatusColor(task.status)}`}>
                      {getStatusLabel(task.status)}
                    </span>
                    {dueBadge && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${dueBadge.color}`}>
                        {dueBadge.text}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-500 truncate">{task.description}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
                  {task.assignee && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-[8px] font-bold text-white">
                        {getInitials(task.assignee.first_name, task.assignee.last_name)}
                      </div>
                      <span className="text-slate-500">{task.assignee.first_name}</span>
                    </div>
                  )}
                  {task.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(task.due_date), 'MMM d')}
                    </span>
                  )}
                </div>

                {/* Quick action */}
                {task.status !== 'COMPLETED' && (
                  <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                    {task.status === 'OPEN' && (
                      <button
                        onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}
                        disabled={updatingTaskId === task.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 transition-colors disabled:opacity-50"
                      >
                        {updatingTaskId === task.id ? '...' : 'Start'}
                      </button>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => onStatusChange(task.id, 'COMPLETED')}
                        disabled={updatingTaskId === task.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
                      >
                        {updatingTaskId === task.id ? '...' : 'Complete'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ===================================================================
// TASK DETAIL SIDEBAR
// ===================================================================

function TaskDetailSidebar({
  task,
  comments,
  activity,
  commentText,
  onCommentChange,
  onAddComment,
  onClose,
  onStatusChange,
  onDelete,
  isUpdating,
}: {
  task: Task | null;
  comments: TaskComment[];
  activity: TaskActivity[];
  commentText: string;
  onCommentChange: (text: string) => void;
  onAddComment: () => void;
  onClose: () => void;
  onStatusChange: (status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED') => void;
  onDelete: () => void;
  isUpdating: boolean;
}) {
  if (!task) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-200 p-5 flex items-start justify-between z-10">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getTaskTypeColor(task.task_type)}`}>
                  {getTaskTypeLabel(task.task_type)}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                  {getPriorityLabel(task.priority)}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{task.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onDelete}
                className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                title="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-6">
            {/* Description */}
            {task.description && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Meta info grid */}
            <div className="grid grid-cols-2 gap-3">
              {task.assignee && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Assigned To</div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {getInitials(task.assignee.first_name, task.assignee.last_name)}
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                      {task.assignee.first_name} {task.assignee.last_name}
                    </span>
                  </div>
                </div>
              )}
              {task.assigner && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Created By</div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {getInitials(task.assigner.first_name, task.assigner.last_name)}
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                      {task.assigner.first_name} {task.assigner.last_name}
                    </span>
                  </div>
                </div>
              )}
              {task.due_date && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Due Date</div>
                  <div className="flex items-center gap-2 text-sm text-slate-900">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {format(new Date(task.due_date), 'PPP p')}
                  </div>
                </div>
              )}
              {task.linked_case && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Linked Case</div>
                  <div className="flex items-center gap-2 text-sm text-slate-900">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    {task.linked_case.case_number}
                  </div>
                </div>
              )}
            </div>

            {/* Status actions */}
            {task.status !== 'COMPLETED' && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Actions</h3>
                <div className="flex gap-2">
                  {task.status === 'OPEN' && (
                    <button
                      onClick={() => onStatusChange('IN_PROGRESS')}
                      disabled={isUpdating}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      Start Task
                    </button>
                  )}
                  {task.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => onStatusChange('COMPLETED')}
                      disabled={isUpdating}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Complete
                    </button>
                  )}
                  {task.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => onStatusChange('OPEN')}
                      disabled={isUpdating}
                      className="px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Activity
              </h3>
              <div className="space-y-3">
                {activity.length === 0 ? (
                  <p className="text-xs text-slate-400">No activity recorded yet.</p>
                ) : (
                  activity.map((act) => (
                    <div key={act.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <div className="w-px h-full bg-slate-200 mt-1" />
                      </div>
                      <div className="pb-3">
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold">{act.userName || 'System'}</span>{' '}
                          {formatActivityAction(act.action)}
                        </p>
                        {act.details?.status && (
                          <span className="text-[10px] text-slate-500">
                            Status: {act.details.status}
                          </span>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {format(new Date(act.createdAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Comments */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Comments ({comments.length})
              </h3>
              <div className="space-y-3 mb-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-[8px] font-bold text-white">
                          {getInitials(comment.creator?.first_name, comment.creator?.last_name)}
                        </div>
                        <span className="text-xs font-semibold text-slate-900">
                          {comment.creator?.first_name} {comment.creator?.last_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 pl-8">{comment.comment}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => onCommentChange(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onAddComment();
                    }
                  }}
                />
                <button
                  onClick={onAddComment}
                  disabled={!commentText.trim()}
                  className="px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ===================================================================
// CREATE TASK MODAL
// ===================================================================

function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  submitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  submitting: boolean;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    taskType: 'PERSONAL' as 'PERSONAL' | 'COMMON' | 'HIERARCHICAL',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    linkedCaseId: '',
    dueDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let dueDate: string | null = null;
    if (formData.dueDate) {
      dueDate = new Date(formData.dueDate).toISOString();
    }
    onSubmit({
      ...formData,
      dueDate,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          placeholder="What needs to be done?"
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all resize-none"
            rows={3}
            placeholder="Add details about this task..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Type</label>
            <select
              value={formData.taskType}
              onChange={(e) => setFormData({ ...formData, taskType: e.target.value as any })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
              required
            >
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
              required
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Due Date"
          type="datetime-local"
          value={formData.dueDate}
          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
        />

        <div className="flex gap-2 justify-end pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}


// ===================================================================
// MAIN PAGE
// ===================================================================

export default function TasksPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // Data state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [analytics, setAnalytics] = useState<TaskAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [sortBy, setSortBy] = useState<SortOption>('dueDate');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sidebar state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskActivity, setTaskActivity] = useState<TaskActivity[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Handle query params for quick create
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taskService.getMyTasks(filters);
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      const data = await taskService.getTaskAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchAnalytics();
  }, [fetchTasks, fetchAnalytics]);

  // Filter & sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.assignee && `${t.assignee.first_name} ${t.assignee.last_name}`.toLowerCase().includes(q)) ||
          (t.linked_case?.case_number && t.linked_case.case_number.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (sortBy === 'dueDate') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      // created
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [tasks, searchQuery, sortBy]);

  // Handlers
  const handleCreateTask = async (formData: any) => {
    setSubmitting(true);
    try {
      await taskService.createTask({
        title: formData.title,
        description: formData.description || undefined,
        assignedTo: user!.id,
        taskType: formData.taskType,
        direction: null,
        priority: formData.priority,
        linkedCaseId: formData.linkedCaseId || null,
        dueDate: formData.dueDate,
      });
      setCreateModalOpen(false);
      fetchTasks();
      fetchAnalytics();
      toast.success('Task created successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED') => {
    setUpdatingTaskId(taskId);
    try {
      await taskService.updateTaskStatus(taskId, { status });
      fetchTasks();
      fetchAnalytics();
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => (prev ? { ...prev, status } : null));
        // Refresh activity
        const activity = await taskService.getTaskActivity(taskId);
        setTaskActivity(activity);
      }
      toast.success(`Task marked as ${getStatusLabel(status)}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update task status');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      await taskService.deleteTask(selectedTask.id);
      setSidebarOpen(false);
      setSelectedTask(null);
      fetchTasks();
      fetchAnalytics();
      toast.success('Task deleted');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewTask = async (task: Task) => {
    setSelectedTask(task);
    setSidebarOpen(true);
    setCommentsLoading(true);
    try {
      const [comments, activity] = await Promise.all([
        taskService.getComments(task.id),
        taskService.getTaskActivity(task.id),
      ]);
      setTaskComments(comments);
      setTaskActivity(activity);
    } catch (error) {
      console.error('Failed to load task details:', error);
      toast.error('Failed to load task details');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTask || !commentText.trim()) return;
    try {
      await taskService.addComment(selectedTask.id, { comment: commentText.trim() });
      setCommentText('');
      const comments = await taskService.getComments(selectedTask.id);
      setTaskComments(comments);
      toast.success('Comment added');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add comment');
    }
  };

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Manage and track your work"
        action={
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Task
          </Button>
        }
      />

      {/* Analytics */}
      <AnalyticsHeader analytics={analytics} loading={analyticsLoading} />

      {/* Filters */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFilterChange={(f) => {
          setFilters(f);
          // Note: filters are applied via fetchTasks dependency, but for now
          // the backend getMyTasks accepts filters. Let me trigger a refetch.
          // Actually fetchTasks depends on filters already.
        }}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        resultCount={filteredTasks.length}
      />

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading tasks...</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          tasks={filteredTasks}
          onTaskClick={handleViewTask}
          onStatusChange={handleUpdateStatus}
          updatingTaskId={updatingTaskId}
        />
      ) : (
        <ListView
          tasks={filteredTasks}
          onTaskClick={handleViewTask}
          onStatusChange={handleUpdateStatus}
          updatingTaskId={updatingTaskId}
        />
      )}

      {/* Create Modal */}
      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        submitting={submitting}
      />

      {/* Detail Sidebar */}
      <AnimatePresence>
        {sidebarOpen && selectedTask && (
          <TaskDetailSidebar
            task={selectedTask}
            comments={taskComments}
            activity={taskActivity}
            commentText={commentText}
            onCommentChange={setCommentText}
            onAddComment={handleAddComment}
            onClose={() => {
              setSidebarOpen(false);
              setSelectedTask(null);
              setCommentText('');
            }}
            onStatusChange={(status) => handleUpdateStatus(selectedTask.id, status)}
            onDelete={handleDeleteTask}
            isUpdating={updatingTaskId === selectedTask.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
