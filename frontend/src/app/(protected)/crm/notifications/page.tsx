'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { useAuth } from '@/contexts/AuthContext';
import {
  crmService,
  CaseNotification,
  getStatusColor,
  getStatusLabel,
} from '@/lib/crm';

export default function NotificationsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [notifications, setNotifications] = useState<CaseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Filters
  const [isReadFilter, setIsReadFilter] = useState<boolean | undefined>(undefined);
  const [completionFilter, setCompletionFilter] = useState<'ONGOING' | 'COMPLETED' | undefined>(undefined);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const [notificationsResult, countResult] = await Promise.all([
        crmService.getUserNotifications({
          is_read: isReadFilter,
          completion_status: completionFilter,
          limit,
          offset,
        }),
        crmService.getUnreadNotificationCount(),
      ]);

      setNotifications(notificationsResult.notifications);
      setTotal(notificationsResult.total);
      setUnreadCount(countResult.count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      alert('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [isReadFilter, completionFilter, limit, offset]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (notificationId: string, isRead: boolean) => {
    try {
      await crmService.markNotificationRead(notificationId, isRead);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to update read status:', error);
      alert('Failed to update read status');
    }
  };

  const handleMarkCompletion = async (notificationId: string, status: 'ONGOING' | 'COMPLETED') => {
    try {
      await crmService.markNotificationCompletion(notificationId, status);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to update completion status:', error);
      alert('Failed to update completion status');
    }
  };

  const handleViewCase = (caseId: string) => {
    router.push(`/crm/cases/${caseId}`);
  };

  const clearFilters = () => {
    setIsReadFilter(undefined);
    setCompletionFilter(undefined);
    setOffset(0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Notifications"
        description="View and manage your scheduled case notifications"
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
                setOffset(0);
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
                setCompletionFilter(value === '' ? undefined : value as 'ONGOING' | 'COMPLETED');
                setOffset(0);
              }}
              options={[
                { value: '', label: 'All Status' },
                { value: 'ONGOING', label: 'Ongoing' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
              className="w-40"
            />

            {(isReadFilter !== undefined || completionFilter) && (
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
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {notifications.filter(n => n.completion_status === 'ONGOING').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="text-sm text-gray-500 mt-4">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No notifications found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
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
                          <h3 className="text-base font-semibold text-gray-900 mb-1">
                            Case: {notification.case_number || notification.case_id.slice(0, 8)}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            Customer: {notification.case_customer_name || 'N/A'}
                          </p>
                          {notification.message && (
                            <p className="text-sm text-gray-700 mb-3 bg-gray-100 p-3 rounded-lg">
                              {notification.message}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            notification.case_status ? getStatusColor(notification.case_status) : 'bg-gray-100 text-gray-800'
                          }`}>
                            {notification.case_status ? getStatusLabel(notification.case_status) : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                        <span>
                          Scheduled by: {notification.scheduled_by.first_name} {notification.scheduled_by.last_name}
                        </span>
                        <span>•</span>
                        <span>Scheduled for: {new Date(notification.scheduled_at).toLocaleString()}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-full ${
                          notification.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          notification.status === 'SENT' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {notification.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="secondary"
                          onClick={() => handleViewCase(notification.case_id)}
                          className="text-sm"
                        >
                          View Case
                        </Button>
                        
                        <Button
                          variant="secondary"
                          onClick={() => handleMarkRead(notification.id, !notification.is_read)}
                          className="text-sm"
                        >
                          {notification.is_read ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Mark Unread
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Mark Read
                            </>
                          )}
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() => handleMarkCompletion(
                            notification.id,
                            notification.completion_status === 'ONGOING' ? 'COMPLETED' : 'ONGOING'
                          )}
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
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

