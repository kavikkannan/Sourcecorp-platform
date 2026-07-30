'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  Filter,
  X,
  Calendar,
  CheckCheck,
  Loader2,
  Trash2,
  Square,
  CheckSquare,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Select from '@/components/Select';
import Input from '@/components/Input';
import { useNotifications } from '@/contexts/NotificationContext';
import { crmService } from '@/lib/crm';
import {
  AppNotification,
  NotificationType,
  notificationService,
} from '@/lib/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { getStatusColor, getStatusLabel } from '@/lib/crm';
import { formatDistanceToNow } from 'date-fns';

const NOTIFICATION_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'CASE_REMINDER', label: 'Case Reminder' },
  { value: 'CHANGE_REQUEST', label: 'Change Request' },
  { value: 'CASE_ASSIGNMENT', label: 'Case Assignment' },
  { value: 'STATUS_CHANGE', label: 'Status Change' },
  { value: 'SYSTEM', label: 'System' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const {
    notifications: contextNotifications,
    unreadCount,
    loading: contextLoading,
    hasMore,
    loadMore,
    refresh,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    markComplete,
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkMarkAsRead,
    bulkMarkAsUnread,
    bulkMarkComplete,
  } = useNotifications();

  // Local filtered view
  const [isReadFilter, setIsReadFilter] = useState<boolean | undefined>(undefined);
  const [completionFilter, setCompletionFilter] = useState<'ONGOING' | 'COMPLETED' | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<NotificationType | undefined>(undefined);
  const [dueDateFrom, setDueDateFrom] = useState<string>('');
  const [dueDateTo, setDueDateTo] = useState<string>('');

  const filteredNotifications = useMemo(() => {
    return contextNotifications.filter((n) => {
      if (isReadFilter !== undefined && n.is_read !== isReadFilter) return false;
      if (completionFilter && n.completion_status !== completionFilter) return false;
      if (typeFilter && n.type !== typeFilter) return false;
      if (dueDateFrom && new Date(n.scheduled_at) < new Date(dueDateFrom)) return false;
      if (dueDateTo && new Date(n.scheduled_at) > new Date(`${dueDateTo}T23:59:59`)) return false;
      return true;
    });
  }, [contextNotifications, isReadFilter, completionFilter, typeFilter, dueDateFrom, dueDateTo]);

  const total = filteredNotifications.length;
  const ongoingCount = filteredNotifications.filter((n) => n.completion_status === 'ONGOING').length;

  const clearFilters = () => {
    setIsReadFilter(undefined);
    setCompletionFilter(undefined);
    setTypeFilter(undefined);
    setDueDateFrom('');
    setDueDateTo('');
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      clearSelection();
    } else {
      selectAll(filteredNotifications.map((n) => n.id));
    }
  };

  const handleApproveChangeRequest = async (notification: AppNotification) => {
    if (!notification.change_request_id) return;
    if (!confirm('Are you sure you want to approve this change request?')) {
      return;
    }
    try {
      await crmService.approveCustomerDetailChangeRequest(notification.change_request_id);
      await refresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve change request');
    }
  };

  const handleRejectChangeRequest = async (notification: AppNotification) => {
    if (!notification.change_request_id) return;
    const remarks = prompt('Please provide a reason for rejection:');
    if (!remarks || !remarks.trim()) {
      alert('Rejection reason is required');
      return;
    }
    try {
      await crmService.rejectCustomerDetailChangeRequest(notification.change_request_id, remarks);
      await refresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject change request');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    try {
      await notificationService.deleteNotification(id);
      await refresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete notification');
    }
  };

  const getTypeBadge = (type: NotificationType) => {
    const colors: Record<NotificationType, string> = {
      CASE_REMINDER: 'bg-gray-100 text-gray-800',
      CHANGE_REQUEST: 'bg-yellow-100 text-yellow-800',
      CASE_ASSIGNMENT: 'bg-blue-100 text-blue-800',
      STATUS_CHANGE: 'bg-purple-100 text-purple-800',
      SYSTEM: 'bg-green-100 text-green-800',
    };
    const labels: Record<NotificationType, string> = {
      CASE_REMINDER: 'Reminder',
      CHANGE_REQUEST: 'Change Request',
      CASE_ASSIGNMENT: 'Assignment',
      STATUS_CHANGE: 'Status Change',
      SYSTEM: 'System',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type]}`}>
        {labels[type]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Notifications"
        description="View and manage your notifications in real time"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>

            <Select
              value={isReadFilter === undefined ? '' : isReadFilter ? 'read' : 'unread'}
              onChange={(e) => {
                const value = e.target.value;
                setIsReadFilter(value === '' ? undefined : value === 'read');
              }}
              options={[
                { value: '', label: 'All' },
                { value: 'read', label: 'Read' },
                { value: 'unread', label: 'Unread' },
              ]}
              className="w-40"
            />

            <Select
              value={completionFilter || ''}
              onChange={(e) => {
                const value = e.target.value;
                setCompletionFilter(value === '' ? undefined : (value as 'ONGOING' | 'COMPLETED'));
              }}
              options={[
                { value: '', label: 'All Status' },
                { value: 'ONGOING', label: 'Ongoing' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
              className="w-40"
            />

            <Select
              value={typeFilter || ''}
              onChange={(e) => {
                const value = e.target.value as NotificationType | '';
                setTypeFilter(value === '' ? undefined : value);
              }}
              options={NOTIFICATION_TYPE_OPTIONS}
              className="w-44"
            />

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <Input
                type="date"
                value={dueDateFrom}
                onChange={(e) => setDueDateFrom(e.target.value)}
                placeholder="From Date"
                className="w-40"
              />
              <span className="text-gray-400">to</span>
              <Input
                type="date"
                value={dueDateTo}
                onChange={(e) => setDueDateTo(e.target.value)}
                placeholder="To Date"
                className="w-40"
              />
            </div>

            {(isReadFilter !== undefined || completionFilter || typeFilter || dueDateFrom || dueDateTo) && (
              <Button variant="secondary" onClick={clearFilters} className="ml-auto">
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Notifications</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
              </div>
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Unread</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{unreadCount}</p>
              </div>
              <EyeOff className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ongoing</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{ongoingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-primary-900">
              <CheckSquare className="w-4 h-4" />
              {selectedIds.length} selected
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={bulkMarkAsRead} className="text-sm">
                <Eye className="w-4 h-4 mr-1" />
                Mark Read
              </Button>
              <Button variant="secondary" onClick={bulkMarkAsUnread} className="text-sm">
                <EyeOff className="w-4 h-4 mr-1" />
                Mark Unread
              </Button>
              <Button variant="secondary" onClick={() => bulkMarkComplete('COMPLETED')} className="text-sm">
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark Completed
              </Button>
              <Button variant="secondary" onClick={() => bulkMarkComplete('ONGOING')} className="text-sm">
                <Clock className="w-4 h-4 mr-1" />
                Mark Ongoing
              </Button>
              <Button variant="secondary" onClick={clearSelection} className="text-sm">
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="text-gray-500 hover:text-primary-600 transition-colors"
              title={selectedIds.length === filteredNotifications.length ? 'Deselect all' : 'Select all'}
            >
              {selectedIds.length === filteredNotifications.length && filteredNotifications.length > 0 ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="text-sm font-medium text-gray-700">Select all</span>
            {unreadCount > 0 && (
              <Button variant="secondary" onClick={markAllAsRead} className="ml-auto text-sm">
                <CheckCheck className="w-4 h-4 mr-1" />
                Mark all as read
              </Button>
            )}
          </div>

          {contextLoading && filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="text-sm text-gray-500 mt-4">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No notifications found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  isSelected={selectedIds.includes(notification.id)}
                  onToggle={() => toggleSelection(notification.id)}
                  onMarkRead={() => markAsRead(notification.id)}
                  onMarkUnread={() => markAsUnread(notification.id)}
                  onMarkComplete={(status) => markComplete(notification.id, status)}
                  onApprove={() => handleApproveChangeRequest(notification)}
                  onReject={() => handleRejectChangeRequest(notification)}
                  onDelete={() => handleDelete(notification.id)}
                  onViewCase={() => router.push(`/crm/cases/${notification.case_id}`)}
                  getTypeBadge={getTypeBadge}
                />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="px-4 py-3 border-t border-gray-200 text-center">
              <Button variant="secondary" onClick={loadMore} disabled={contextLoading} className="text-sm">
                {contextLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface NotificationItemProps {
  notification: AppNotification;
  isSelected: boolean;
  onToggle: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onMarkComplete: (status: 'ONGOING' | 'COMPLETED') => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onViewCase: () => void;
  getTypeBadge: (type: NotificationType) => React.ReactNode;
}

function NotificationItem({
  notification,
  isSelected,
  onToggle,
  onMarkRead,
  onMarkUnread,
  onMarkComplete,
  onApprove,
  onReject,
  onDelete,
  onViewCase,
  getTypeBadge,
}: NotificationItemProps) {
  const { hasPermission } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 hover:bg-gray-50 transition-colors ${
        !notification.is_read ? 'bg-blue-50/50' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="text-gray-400 hover:text-primary-600 transition-colors"
          >
            {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-shrink-0">
          {!notification.is_read ? (
            <div className="w-3 h-3 bg-blue-600 rounded-full mt-2"></div>
          ) : (
            <div className="w-3 h-3 bg-transparent rounded-full mt-2"></div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-gray-900">
                  {notification.title || 'Notification'}
                </h3>
                {getTypeBadge(notification.type)}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Case: {notification.case_number || notification.case_id.slice(0, 8)}
                {notification.case_customer_name && ` • ${notification.case_customer_name}`}
              </p>
              {notification.message && (
                <p className="text-sm text-gray-700 mb-3 bg-gray-100 p-3 rounded-lg">
                  {notification.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {notification.case_status && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(notification.case_status)}`}>
                  {getStatusLabel(notification.case_status)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 flex-wrap">
            {notification.scheduled_by_user && (
              <span>
                From: {notification.scheduled_by_user.first_name} {notification.scheduled_by_user.last_name}
              </span>
            )}
            <span>•</span>
            <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
            <span>•</span>
            <span className={`px-2 py-0.5 rounded-full ${
              notification.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
              notification.status === 'SENT' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {notification.status}
            </span>
          </div>

          {/* Change Request Actions */}
          {notification.change_request_id && notification.change_request_status === 'PENDING' && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-900 mb-2">Change Request Pending Approval</p>
              {notification.change_request_changes && (
                <div className="text-xs text-yellow-800 mb-3">
                  <p className="font-medium mb-1">Requested Changes:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.entries(notification.change_request_changes).map(([key, value]) => (
                      <li key={key}>
                        <span className="font-medium">{key.replace(/_/g, ' ')}:</span> {String(value)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={onApprove} className="text-sm bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button variant="secondary" onClick={onReject} className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50">
                  <X className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          )}

          {notification.change_request_id && notification.change_request_status === 'APPROVED' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-semibold text-green-900">✓ Change Request Approved</p>
            </div>
          )}

          {notification.change_request_id && notification.change_request_status === 'REJECTED' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-semibold text-red-900">✗ Change Request Rejected</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" onClick={onViewCase} className="text-sm">
              View Case
            </Button>

            {notification.is_read ? (
              <Button variant="secondary" onClick={onMarkUnread} className="text-sm">
                <EyeOff className="w-4 h-4 mr-2" />
                Mark Unread
              </Button>
            ) : (
              <Button variant="secondary" onClick={onMarkRead} className="text-sm">
                <Eye className="w-4 h-4 mr-2" />
                Mark Read
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => onMarkComplete(notification.completion_status === 'ONGOING' ? 'COMPLETED' : 'ONGOING')}
              className={`text-sm ${
                notification.completion_status === 'COMPLETED' ? 'bg-green-50 text-green-700 hover:bg-green-100' : ''
              }`}
            >
              {notification.completion_status === 'ONGOING' ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Completed
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Mark Ongoing
                </>
              )}
            </Button>

            <Button
              variant="secondary"
              onClick={onDelete}
              className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
