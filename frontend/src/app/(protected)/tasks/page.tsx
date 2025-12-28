'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, X, MessageSquare, Calendar, Tag, Briefcase } from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

export default function TasksPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<{
    status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    taskType?: 'PERSONAL' | 'COMMON' | 'HIERARCHICAL';
  }>({});

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    taskType: 'PERSONAL' as 'PERSONAL' | 'COMMON' | 'HIERARCHICAL',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    linkedCaseId: '',
    dueDate: '',
  });

  useEffect(() => {
    const action = searchParams.get('action');
    const type = searchParams.get('type');
    if (action === 'create') {
      if (type === 'personal') {
        setFormData(prev => ({ ...prev, taskType: 'PERSONAL' }));
      }
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const tasksData = await taskService.getMyTasks(filters);
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let dueDate: string | null = null;
      if (formData.dueDate) {
        dueDate = new Date(formData.dueDate).toISOString();
      }

      await taskService.createTask({
        title: formData.title,
        description: formData.description || undefined,
        assignedTo: user!.id, // For personal tasks, assign to self
        taskType: formData.taskType,
        direction: formData.taskType === 'HIERARCHICAL' ? null : null,
        priority: formData.priority,
        linkedCaseId: formData.linkedCaseId || null,
        dueDate,
      });
      
      setCreateModalOpen(false);
      setFormData({ title: '', description: '', taskType: 'PERSONAL', priority: 'MEDIUM', linkedCaseId: '', dueDate: '' });
      fetchTasks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      await taskService.updateTaskStatus(taskId, { status });
      fetchTasks();
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, status });
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update task status');
    }
  };

  const handleViewTask = async (task: Task) => {
    setSelectedTask(task);
    try {
      const comments = await taskService.getComments(task.id);
      setTaskComments(comments);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTask || !commentText.trim()) return;

    try {
      const comment = await taskService.addComment(selectedTask.id, { comment: commentText });
      setTaskComments([...taskComments, comment]);
      setCommentText('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add comment');
    }
  };

  return (
    <div>
      <PageHeader
        title="My Tasks"
        description="Manage your personal, common, and hierarchical tasks"
        action={
          <Button
            icon={<Plus className="w-5 h-5" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Task
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as any || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Statuses</option>
            {TASK_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={filters.priority || ''}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value as any || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Priorities</option>
            {TASK_PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={filters.taskType || ''}
            onChange={(e) => setFilters({ ...filters, taskType: e.target.value as any || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Types</option>
            {TASK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No tasks found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleViewTask(task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTaskTypeColor(task.task_type)}`}>
                        {getTaskTypeLabel(task.task_type)}
                      </span>
                      <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-gray-600 mb-3">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {task.linked_case && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          {task.linked_case.case_number}
                        </span>
                      )}
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(task.due_date), 'MMM dd, yyyy')}
                        </span>
                      )}
                      <span>{format(new Date(task.created_at), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>
                  {task.status !== 'COMPLETED' && (
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
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setFormData({ title: '', description: '', taskType: 'PERSONAL', priority: 'MEDIUM', linkedCaseId: '', dueDate: '' });
        }}
        title="Create Task"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Task Type</label>
            <select
              value={formData.taskType}
              onChange={(e) => setFormData({ ...formData, taskType: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              required
            >
              {TASK_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              required
            >
              {TASK_PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

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
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Detail Drawer */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedTask(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedTask.title}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTaskTypeColor(selectedTask.task_type)}`}>
                      {getTaskTypeLabel(selectedTask.task_type)}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedTask.status)}`}>
                      {getStatusLabel(selectedTask.status)}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedTask.priority)}`}>
                      {getPriorityLabel(selectedTask.priority)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {selectedTask.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                    <p className="text-gray-600">{selectedTask.description}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments
                  </h3>
                  <div className="space-y-3 mb-4">
                    {taskComments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {comment.creator?.first_name} {comment.creator?.last_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddComment();
                        }
                      }}
                    />
                    <Button onClick={handleAddComment} disabled={!commentText.trim()}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

