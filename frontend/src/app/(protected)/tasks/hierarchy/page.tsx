'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  Trash2,
  Filter,
  X,
  Send,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import {
  taskService,
  Task,
  TaskComment,
  getStatusColor,
  getStatusLabel,
  getPriorityColor,
  getPriorityLabel,
  TASK_PRIORITIES,
} from '@/lib/tasks';
import { hierarchyService, User } from '@/lib/hierarchy';
import { useAuth } from '@/contexts/AuthContext';

export default function HierarchyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subordinates, setSubordinates] = useState<User[]>([]);
  const [manager, setManager] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [direction, setDirection] = useState<'DOWNWARD' | 'UPWARD'>('DOWNWARD');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'assigned-to-me' | 'assigned-by-me' | 'subordinates'>(
    'assigned-to-me'
  );

  // Detail view
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH'>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = async () => {
    try {
      const [subordinatesData, managerData] = await Promise.all([
        hierarchyService.getMySubordinates(),
        hierarchyService.getMyManager(),
      ]);
      setSubordinates(subordinatesData);
      setManager(managerData);
      fetchTasks();
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = useCallback(async () => {
    try {
      let tasksData: Task[] = [];
      const statusParam = statusFilter !== 'ALL' ? statusFilter : undefined;
      if (activeTab === 'assigned-to-me') {
        tasksData = await taskService.getTasksAssignedToMe(statusParam);
      } else if (activeTab === 'assigned-by-me') {
        tasksData = await taskService.getTasksAssignedByMe(statusParam);
      } else if (activeTab === 'subordinates') {
        tasksData = await taskService.getSubordinateTasks(statusParam);
      }
      // Client-side priority filter
      if (priorityFilter !== 'ALL') {
        tasksData = tasksData.filter((t) => t.priority === priorityFilter);
      }
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  }, [activeTab, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchTasks();
    }
  }, [activeTab, loading, fetchTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let dueDate: string | null = null;
      if (formData.dueDate) {
        const date = new Date(formData.dueDate);
        dueDate = date.toISOString();
      }

      const assignedTo = direction === 'UPWARD' && manager ? manager.id : formData.assignedTo;

      if (!assignedTo) {
        alert(direction === 'UPWARD' ? 'Manager not found' : 'Please select a subordinate');
        setSubmitting(false);
        return;
      }

      await taskService.createTask({
        title: formData.title,
        description: formData.description || undefined,
        assignedTo,
        taskType: 'HIERARCHICAL',
        direction,
        priority: formData.priority,
        dueDate,
      });
      setCreateModalOpen(false);
      setFormData({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'MEDIUM' });
      fetchTasks();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.details?.map((d: any) => d.message).join(', ') ||
        'Failed to create task';
      alert(errorMessage);
      console.error('Task creation error:', error.response?.data);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      await taskService.updateTaskStatus(taskId, { status });
      fetchTasks();
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update task status');
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      await taskService.deleteTask(selectedTask.id);
      setDeleteModalOpen(false);
      setDetailModalOpen(false);
      setSelectedTask(null);
      fetchTasks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete task');
    } finally {
      setSubmitting(false);
    }
  };

  const openTaskDetail = async (task: Task) => {
    setSelectedTask(task);
    setDetailModalOpen(true);
    setCommentsLoading(true);
    try {
      const data = await taskService.getComments(task.id);
      setComments(data);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;
    setSubmitting(true);
    try {
      await taskService.addComment(selectedTask.id, { comment: newComment.trim() });
      setNewComment('');
      const data = await taskService.getComments(selectedTask.id);
      setComments(data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'IN_PROGRESS':
        return <Clock className="w-4 h-4" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const canAssignDownward = subordinates.length > 0;
  const canRaiseUpward = manager !== null;

  return (
    <div>
      <PageHeader
        title="Hierarchical Tasks"
        description="Manage tasks within your reporting hierarchy"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters((p) => !p)}
            >
              Filters
            </Button>
            {(canAssignDownward || canRaiseUpward) && (
              <Button
                icon={<Plus className="w-5 h-5" />}
                onClick={() => {
                  setDirection(canAssignDownward ? 'DOWNWARD' : 'UPWARD');
                  setFormData({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'MEDIUM' });
                  setCreateModalOpen(true);
                }}
              >
                Create Task
              </Button>
            )}
          </div>
        }
      />

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div className="flex-1" />
          <Button
            variant="secondary"
            className="text-xs px-3 py-2"
            onClick={() => {
              setStatusFilter('ALL');
              setPriorityFilter('ALL');
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('assigned-to-me')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'assigned-to-me'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Assigned to Me
            </button>
            {canAssignDownward && (
              <button
                onClick={() => setActiveTab('assigned-by-me')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'assigned-by-me'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Assigned by Me
              </button>
            )}
            {canAssignDownward && (
              <button
                onClick={() => setActiveTab('subordinates')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'subordinates'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Subordinate Tasks
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No tasks found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => openTaskDetail(task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {task.direction === 'DOWNWARD' ? (
                        <ArrowDown className="w-5 h-5 text-blue-500" />
                      ) : (
                        <ArrowUp className="w-5 h-5 text-green-500" />
                      )}
                      <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span>
                        {task.direction === 'DOWNWARD' ? 'Assigned to' : 'Raised to'}:{' '}
                        <strong>
                          {task.assignee?.first_name} {task.assignee?.last_name}
                        </strong>
                      </span>
                      <span>
                        {task.direction === 'DOWNWARD' ? 'By' : 'From'}:{' '}
                        <strong>
                          {task.assigner?.first_name} {task.assigner?.last_name}
                        </strong>
                      </span>
                      {task.due_date && (
                        <span>
                          Due: <strong>{new Date(task.due_date).toLocaleDateString()}</strong>
                        </span>
                      )}
                      <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {activeTab === 'assigned-to-me' && task.status !== 'COMPLETED' && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {task.status === 'OPEN' && (
                          <Button
                            variant="secondary"
                            className="text-xs px-3 py-1.5"
                            onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}
                          >
                            Start
                          </Button>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                          <Button
                            className="text-xs px-3 py-1.5"
                            onClick={() => handleUpdateStatus(task.id, 'COMPLETED')}
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    )}
                    {(activeTab === 'assigned-by-me' || activeTab === 'subordinates') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                          setDeleteModalOpen(true);
                        }}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Task"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setFormData({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'MEDIUM' });
        }}
        title={direction === 'DOWNWARD' ? 'Assign Task to Subordinate' : 'Raise Task to Manager'}
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              {direction === 'DOWNWARD' ? (
                <>
                  <ArrowDown className="w-4 h-4" />
                  <span>This task will be assigned to a subordinate</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-4 h-4" />
                  <span>This task will be raised to your manager</span>
                </>
              )}
            </div>
          </div>

          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {direction === 'DOWNWARD' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Assign To</label>
              <select
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
                required
              >
                <option value="">Select a subordinate</option>
                {subordinates.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.first_name} {sub.last_name} ({sub.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-700">
                <strong>Manager:</strong> {manager?.first_name} {manager?.last_name} ({manager?.email})
              </div>
            </div>
          )}

          <Input
            label="Due Date"
            type="datetime-local"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setCreateModalOpen(false);
                setFormData({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'MEDIUM' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {direction === 'DOWNWARD' ? 'Assign Task' : 'Raise Task'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedTask(null);
          setComments([]);
          setNewComment('');
        }}
        title={selectedTask?.title || 'Task Details'}
      >
        {selectedTask && (
          <div className="space-y-6">
            {/* Task Info */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedTask.status)}`}>
                {getStatusLabel(selectedTask.status)}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedTask.priority)}`}>
                {getPriorityLabel(selectedTask.priority)}
              </span>
              {selectedTask.direction === 'DOWNWARD' ? (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                  <ArrowDown className="w-3 h-3 inline mr-1" /> Downward
                </span>
              ) : (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                  <ArrowUp className="w-3 h-3 inline mr-1" /> Upward
                </span>
              )}
            </div>

            {selectedTask.description && (
              <p className="text-gray-700 text-sm">{selectedTask.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">{selectedTask.direction === 'DOWNWARD' ? 'Assigned To' : 'Raised To'}</div>
                <div className="font-medium text-gray-900">
                  {selectedTask.assignee?.first_name} {selectedTask.assignee?.last_name}
                </div>
                <div className="text-xs text-gray-500">{selectedTask.assignee?.email}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">{selectedTask.direction === 'DOWNWARD' ? 'Assigned By' : 'Raised By'}</div>
                <div className="font-medium text-gray-900">
                  {selectedTask.assigner?.first_name} {selectedTask.assigner?.last_name}
                </div>
                <div className="text-xs text-gray-500">{selectedTask.assigner?.email}</div>
              </div>
            </div>

            {selectedTask.due_date && (
              <div className="text-sm text-gray-600">
                <strong>Due:</strong> {new Date(selectedTask.due_date).toLocaleString()}
              </div>
            )}

            {/* Status Actions */}
            {activeTab === 'assigned-to-me' && selectedTask.status !== 'COMPLETED' && (
              <div className="flex gap-2">
                {selectedTask.status === 'OPEN' && (
                  <Button
                    variant="secondary"
                    className="text-xs px-4 py-2"
                    onClick={() => handleUpdateStatus(selectedTask.id, 'IN_PROGRESS')}
                  >
                    <Clock className="w-4 h-4 mr-1" /> Start Task
                  </Button>
                )}
                {selectedTask.status === 'IN_PROGRESS' && (
                  <Button
                    className="text-xs px-4 py-2"
                    onClick={() => handleUpdateStatus(selectedTask.id, 'COMPLETED')}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Complete Task
                  </Button>
                )}
              </div>
            )}

            {/* Comments Section */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments ({comments.length})
              </h4>

              {commentsLoading ? (
                <div className="text-sm text-gray-500 py-4">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">No comments yet.</div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">
                          {comment.creator?.first_name} {comment.creator?.last_name}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <Button type="submit" loading={submitting} className="px-3 py-2">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>

            {/* Delete Action */}
            {(activeTab === 'assigned-by-me' || activeTab === 'subordinates') && (
              <div className="border-t border-gray-200 pt-4">
                <Button
                  variant="danger"
                  className="text-xs"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => {
                    setDetailModalOpen(false);
                    setDeleteModalOpen(true);
                  }}
                >
                  Delete Task
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedTask(null);
        }}
        title="Delete Task"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-700">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <p className="text-sm">
              Are you sure you want to delete <strong>{selectedTask?.title}</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setSelectedTask(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteTask} loading={submitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
