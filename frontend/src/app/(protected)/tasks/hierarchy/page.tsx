'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowUp, ArrowDown, CheckCircle2, Circle, Clock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import { taskService, Task, TASK_STATUSES, getStatusColor, getStatusLabel } from '@/lib/tasks';
import { hierarchyService, User } from '@/lib/hierarchy';
import { useAuth } from '@/contexts/AuthContext';

export default function HierarchyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subordinates, setSubordinates] = useState<User[]>([]);
  const [manager, setManager] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [direction, setDirection] = useState<'DOWNWARD' | 'UPWARD'>('DOWNWARD');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'assigned-to-me' | 'assigned-by-me' | 'subordinates'>(
    'assigned-to-me'
  );

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
      if (activeTab === 'assigned-to-me') {
        tasksData = await taskService.getTasksAssignedToMe();
      } else if (activeTab === 'assigned-by-me') {
        tasksData = await taskService.getTasksAssignedByMe();
      } else if (activeTab === 'subordinates') {
        tasksData = await taskService.getSubordinateTasks();
      }
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  }, [activeTab]);

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
      // Convert datetime-local to ISO string if provided
      let dueDate: string | null = null;
      if (formData.dueDate) {
        // datetime-local format: "YYYY-MM-DDTHH:mm"
        // Convert to ISO string: "YYYY-MM-DDTHH:mm:ss.sssZ"
        const date = new Date(formData.dueDate);
        dueDate = date.toISOString();
      }

      // For UPWARD tasks, assignedTo should be the manager's ID
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
        priority: 'MEDIUM',
        dueDate,
      });
      setCreateModalOpen(false);
      setFormData({ title: '', description: '', assignedTo: '', dueDate: '' });
      fetchTasks();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 
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
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update task status');
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
          (canAssignDownward || canRaiseUpward) && (
            <Button
              icon={<Plus className="w-5 h-5" />}
              onClick={() => {
                setDirection(canAssignDownward ? 'DOWNWARD' : 'UPWARD');
                setFormData({ title: '', description: '', assignedTo: '', dueDate: '' });
                setCreateModalOpen(true);
              }}
            >
              Create Task
            </Button>
          )
        }
      />

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
              <div key={task.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {task.direction === 'DOWNWARD' ? (
                        <ArrowDown className="w-5 h-5 text-blue-500" />
                      ) : (
                        <ArrowUp className="w-5 h-5 text-green-500" />
                      )}
                      <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          task.status
                        )}`}
                      >
                        {getStatusLabel(task.status)}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-gray-600 mb-3">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
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
                      <span>
                        Created: {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {activeTab === 'assigned-to-me' && task.status !== 'COMPLETED' && (
                    <div className="flex gap-2">
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
          setFormData({ title: '', description: '', assignedTo: '', dueDate: '' });
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              rows={4}
            />
          </div>

          {direction === 'DOWNWARD' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Assign To</label>
              <select
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
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
                <strong>Manager:</strong> {manager?.first_name} {manager?.last_name} (
                {manager?.email})
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
                setFormData({ title: '', description: '', assignedTo: '', dueDate: '' });
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
    </div>
  );
}

