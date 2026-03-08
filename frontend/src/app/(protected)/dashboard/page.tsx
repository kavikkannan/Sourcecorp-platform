'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Shield,
  UsersRound,
  Megaphone,
  Briefcase,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  IndianRupee,
  Award,
  Building2,
  Info,
  Clock,
  AlertCircle,
  Calendar,
  Bell,
} from 'lucide-react';
import api, { API_URL } from '@/lib/api';
import { crmService, Case, CASE_STATUSES, CaseNotification } from '@/lib/crm';
import { taskService, Task } from '@/lib/tasks';
import { format, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';
import { useRouter } from 'next/navigation';

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  category: 'GENERAL' | 'BANK_UPDATES' | 'SALES_REPORT';
  image_path?: string | null;
  author_name: string;
  created_at: string;
}

interface CaseStatistics {
  newCases: number;
  loginCases: number; // LOGIN cases
  underwritingAmount: number; // UNDERWRITING cases amount
  approvedAmount: number;
  disbursedAmount: number;
  rejectedAmount: number;
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'individual' | 'team'>('individual');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [individualStats, setIndividualStats] = useState<CaseStatistics>({
    newCases: 0,
    loginCases: 0,
    underwritingAmount: 0,
    approvedAmount: 0,
    disbursedAmount: 0,
    rejectedAmount: 0,
  });
  const [teamStats, setTeamStats] = useState<CaseStatistics>({
    newCases: 0,
    loginCases: 0,
    underwritingAmount: 0,
    approvedAmount: 0,
    disbursedAmount: 0,
    rejectedAmount: 0,
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [upcomingNotifications, setUpcomingNotifications] = useState<CaseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);

  const calculateStatistics = useCallback((cases: Case[], isTeam: boolean = false): CaseStatistics => {
    const stats: CaseStatistics = {
      newCases: 0,
      loginCases: 0,
      underwritingAmount: 0,
      approvedAmount: 0,
      disbursedAmount: 0,
      rejectedAmount: 0,
    };

    cases.forEach((caseItem) => {
      switch (caseItem.current_status) {
        case 'NEW':
          stats.newCases++;
          break;
        case 'LOGIN':
          stats.loginCases++;
          break;
        case 'CREDIT_UNDERWRITING':
          stats.underwritingAmount += caseItem.loan_amount;
          break;
        case 'CREDIT_APPROVED':
          stats.approvedAmount += caseItem.loan_amount;
          break;
        case 'DISBURSED':
          stats.disbursedAmount += caseItem.loan_amount;
          break;
        case 'REJECTED':
          stats.rejectedAmount += caseItem.loan_amount;
          break;
      }
    });

    return stats;
  }, []);

  const loadDashboardData = useCallback(async () => {
    // Don't load data if user is not available yet
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      const promises: Promise<any>[] = [];

      // Load cases (most users should have access)
      if (hasPermission('crm.case.view')) {
        // Fetch individual and team cases separately
        const individualPromise = crmService.getCases({ 
          view_type: 'individual', 
          limit: 1000,
          month: selectedMonth
        }).then((res) => {
          const individualCases = res.cases;
          const individualStats = calculateStatistics(individualCases, false);
          setIndividualStats(individualStats);
          return { cases: individualCases, success: true };
        }).catch(() => ({ cases: [], success: false }));

        const teamPromise = crmService.getCases({ 
          view_type: 'team', 
          limit: 1000,
          month: selectedMonth
        }).then((res) => {
          const teamCases = res.cases;
          const teamStats = calculateStatistics(teamCases, true);
          setTeamStats(teamStats);
          return { cases: teamCases, success: true };
        }).catch(() => ({ cases: [], success: false }));

        promises.push(
          Promise.all([individualPromise, teamPromise]).then(([individualResult, teamResult]) => {
            // Combine both individual and team cases, removing duplicates by id
            const allCasesMap = new Map<string, Case>();
            individualResult.cases.forEach((c: Case) => allCasesMap.set(c.id, c));
            teamResult.cases.forEach((c: Case) => allCasesMap.set(c.id, c));
            setAllCases(Array.from(allCasesMap.values()));
            return { success: true };
          })
        );
      }

      // Load announcements (try to load, handle permission errors gracefully)
      promises.push(
        api.get('/admin/announcements', { params: { activeOnly: 'true' } })
          .then((res) => {
            const data = res.data;
            let activeAnnouncements: Announcement[] = [];
            
            // Handle new format: { announcements: [...], total: ... }
            if (data?.announcements && Array.isArray(data.announcements)) {
              activeAnnouncements = data.announcements.filter((a: Announcement) => a.is_active);
            } 
            // Handle old format: direct array
            else if (Array.isArray(data)) {
              activeAnnouncements = data.filter((a: Announcement) => a.is_active);
            }
            
            setAnnouncements(activeAnnouncements.slice(0, 5)); // Show latest 5
            return { success: true };
          })
          .catch(() => {
            // If no permission, just don't show announcements
            setAnnouncements([]);
            return { success: false };
          })
      );

      // Load upcoming tasks (due within next 7 days)
      promises.push(
        taskService.getTasksAssignedToMe()
          .then((tasks) => {
            const now = new Date();
            const sevenDaysFromNow = addDays(now, 7);
            const upcoming = tasks
              .filter((task) => {
                if (!task.due_date || task.status === 'COMPLETED') return false;
                const dueDate = new Date(task.due_date);
                return isAfter(dueDate, now) && isBefore(dueDate, sevenDaysFromNow);
              })
              .sort((a, b) => {
                const dateA = new Date(a.due_date!).getTime();
                const dateB = new Date(b.due_date!).getTime();
                return dateA - dateB;
              })
              .slice(0, 5); // Show top 5
            setUpcomingTasks(upcoming);
            return { success: true };
          })
          .catch(() => {
            setUpcomingTasks([]);
            return { success: false };
          })
      );

      // Load upcoming notifications
      promises.push(
        crmService.getUserNotifications({ limit: 50, is_read: false })
          .then((res) => {
            const now = new Date();
            const sevenDaysFromNow = addDays(now, 7);
            const upcoming = res.notifications
              .filter((notif: CaseNotification) => {
                if (!notif.scheduled_at) return false;
                const scheduledDate = new Date(notif.scheduled_at);
                return isAfter(scheduledDate, now) && isBefore(scheduledDate, sevenDaysFromNow);
              })
              .sort((a: CaseNotification, b: CaseNotification) => {
                const dateA = new Date(a.scheduled_at!).getTime();
                const dateB = new Date(b.scheduled_at!).getTime();
                return dateA - dateB;
              })
              .slice(0, 5); // Show top 5
            setUpcomingNotifications(upcoming);
            return { success: true };
          })
          .catch(() => {
            setUpcomingNotifications([]);
            return { success: false };
          })
      );

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, hasPermission, calculateStatistics, selectedMonth]);

  useEffect(() => {
    // Only load data when user is available
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  // Auto-refresh announcements every 30 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      // Only refresh announcements, not all dashboard data
      api.get('/admin/announcements', { params: { activeOnly: 'true' } })
        .then((res) => {
          const data = res.data;
          let activeAnnouncements: Announcement[] = [];
          
          // Handle new format: { announcements: [...], total: ... }
          if (data?.announcements && Array.isArray(data.announcements)) {
            activeAnnouncements = data.announcements.filter((a: Announcement) => a.is_active);
          } 
          // Handle old format: direct array
          else if (Array.isArray(data)) {
            activeAnnouncements = data.filter((a: Announcement) => a.is_active);
          }
          
          setAnnouncements(activeAnnouncements.slice(0, 5)); // Show latest 5
        })
        .catch(() => {
          // Silently fail if no permission
        });
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  // Auto-advance announcements slideshow
  useEffect(() => {
    if (announcements.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [announcements.length]);

  const currentStats = activeTab === 'individual' ? individualStats : teamStats;
  const hasTeamAccess = hasPermission('admin.teams.read') || hasPermission('crm.case.view_all');

  // Format INR amount
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!hasPermission('crm.case.view')) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description={`Welcome back, ${user?.firstName}!`}
        />
        <div className="bg-white rounded-lg shadow-sm p-12 border border-gray-200 text-center">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Welcome to Sourcecorp Solution Platform
          </h3>
          <p className="text-gray-600 mb-6">
            {user?.firstName ? `Welcome back, ${user.firstName}!` : 'Welcome!'}
          </p>
          <p className="text-sm text-gray-500">
            Contact your administrator to get access to features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.firstName}!`}
      />

      {/* Case Statistics Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Case Statistics</h2>
          <div className="flex items-center gap-4">
            {/* Month Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {(() => {
                  const options = [];
                  const now = new Date();
                  for (let i = 0; i < 12; i++) {
                    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const value = `${year}-${month}`;
                    const label = format(date, 'MMMM yyyy');
                    options.push({ value, label });
                  }
                  return options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ));
                })()}
              </select>
            </div>
            {hasTeamAccess && (
              <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('individual')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'individual'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Individual
                </button>
                <button
                  onClick={() => setActiveTab('team')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'team'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Team
                </button>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {/* COUNT Cards */}
            <div className="bg-blue-100 rounded-lg p-4 border-2 border-blue-300">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-900">New Cases</p>
                <Briefcase className="w-5 h-5 text-blue-700" />
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {loading ? '...' : currentStats.newCases}
              </p>
              <p className="text-xs text-blue-800 mt-1">Count</p>
            </div>

            <div className="bg-purple-100 rounded-lg p-4 border-2 border-purple-300">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-purple-900">Login Cases</p>
                <FileText className="w-5 h-5 text-purple-700" />
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {loading ? '...' : currentStats.loginCases}
              </p>
              <p className="text-xs text-purple-800 mt-1">Count</p>
            </div>

            {/* AMOUNT Cards */}
            <div className="bg-indigo-100 rounded-lg p-4 border-2 border-indigo-300">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-indigo-900">Underwriting Amount</p>
                <TrendingUp className="w-5 h-5 text-indigo-700" />
              </div>
              <p className="text-2xl font-bold text-indigo-900">
                {loading ? '...' : formatAmount(currentStats.underwritingAmount)}
              </p>
              <p className="text-xs text-indigo-800 mt-1">Amount</p>
            </div>

            <div className="bg-green-100 rounded-lg p-4 border-2 border-green-300">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-green-900">Approved Amount</p>
                <CheckCircle className="w-5 h-5 text-green-700" />
              </div>
              <p className="text-2xl font-bold text-green-900">
                {loading ? '...' : formatAmount(currentStats.approvedAmount)}
              </p>
              <p className="text-xs text-green-800 mt-1">Amount</p>
            </div>

            <div className="bg-teal-100 rounded-lg p-4 border-2 border-teal-300">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-teal-900">Disbursed Amount</p>
                <IndianRupee className="w-5 h-5 text-teal-700" />
              </div>
              <p className="text-2xl font-bold text-teal-900">
                {loading ? '...' : formatAmount(currentStats.disbursedAmount)}
              </p>
              <p className="text-xs text-teal-800 mt-1">Amount</p>
            </div>

            <div className="bg-red-100 rounded-lg p-4 border-2 border-red-300">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-red-900">Rejected Amount</p>
                <XCircle className="w-5 h-5 text-red-700" />
              </div>
              <p className="text-2xl font-bold text-red-900">
                {loading ? '...' : formatAmount(currentStats.rejectedAmount)}
              </p>
              <p className="text-xs text-red-800 mt-1">Amount</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Two Column Layout: Announcements and Upcoming Tasks/Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Announcements Slideshow */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
              </div>
              {announcements.length > 1 && (
                <div className="flex items-center gap-1">
                  {announcements.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentAnnouncementIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentAnnouncementIndex
                          ? 'bg-orange-600 w-6'
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      aria-label={`Go to announcement ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          {announcements.length > 0 ? (
            <div className="relative h-[500px] overflow-hidden cursor-pointer group" onClick={() => router.push('/announcements')}>
              <AnimatePresence mode="wait">
                {announcements.map((announcement, index) => {
                  if (index !== currentAnnouncementIndex) return null;
                  
                  return (
                    <motion.div
                      key={announcement.id}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 p-6 flex flex-col"
                    >
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          announcement.category === 'BANK_UPDATES' 
                            ? 'bg-blue-100 text-blue-700' 
                            : announcement.category === 'SALES_REPORT'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {announcement.category === 'BANK_UPDATES' ? 'Bank Updates' : 
                           announcement.category === 'SALES_REPORT' ? 'Sales Report' : 
                           'General'}
                        </span>
                        <h3 className="text-sm font-semibold text-gray-700 truncate max-w-xs">
                          {announcement.title.length > 40 
                            ? `${announcement.title.substring(0, 40)}...` 
                            : announcement.title}
                        </h3>
                      </div>
                      
                      <h3 
                        className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 cursor-pointer hover:text-primary-600 transition-colors"
                        onClick={() => router.push('/announcements')}
                      >
                        {announcement.title}
                      </h3>
                      
                      {announcement.image_path && (
                        <div className="mb-4 flex-shrink-0 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 p-2">
                          <img 
                            src={`${API_URL.replace('/api', '')}/api/announcements/${announcement.id}/image`}
                            alt={announcement.title}
                            className="max-w-full max-h-48 w-auto h-auto object-contain rounded-lg"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      <div className="flex-1 overflow-y-auto">
                        <p className="text-sm text-gray-700 leading-relaxed mb-4">
                          {announcement.content}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 mt-auto">
                        <p className="text-xs text-gray-500">
                          By {announcement.author_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(announcement.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-8 text-center h-[500px] flex items-center justify-center">
              <div>
                <Megaphone className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600">No announcements to show</p>
            </div>
          </div>
        )}
        </div>

        {/* Right Column: Upcoming Tasks & Notifications */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Upcoming Reminders</h2>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {/* Upcoming Tasks */}
              {upcomingTasks.map((task, index) => {
                const dueDate = new Date(task.due_date!);
                const daysUntilDue = differenceInDays(dueDate, new Date());
                const isUrgent = daysUntilDue <= 2;
                
                return (
                  <motion.div
                    key={`task-${task.id}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => {
                      if (task.linked_case) {
                        router.push(`/crm/cases/${task.linked_case.id}`);
                      } else {
                        router.push('/tasks');
                      }
                    }}
                    className={`p-2.5 rounded-md border transition-colors cursor-pointer ${
                      isUrgent 
                        ? 'bg-red-50 border-red-200 hover:bg-red-100' 
                        : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        isUrgent ? 'text-red-600' : 'text-yellow-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">{task.title}</h3>
                          <span className={`px-1.5 py-0.5 text-xs rounded-full flex-shrink-0 ${
                            task.priority === 'HIGH' 
                              ? 'bg-red-100 text-red-700'
                              : task.priority === 'MEDIUM'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                          <Calendar className="w-3 h-3" />
                          <span className={isUrgent ? 'font-semibold text-red-700' : ''}>
                            Due: {format(dueDate, 'MMM dd, yyyy')} 
                            {daysUntilDue === 0 && ' (Today)'}
                            {daysUntilDue === 1 && ' (Tomorrow)'}
                            {daysUntilDue > 1 && ` (${daysUntilDue} days)`}
                          </span>
                        </div>
                        {task.linked_case && (
                          <p className="text-xs text-gray-500 truncate">
                            Case: {task.linked_case.case_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Upcoming Notifications */}
              {upcomingNotifications.map((notif, index) => {
                if (!notif.scheduled_at) return null;
                const scheduledDate = new Date(notif.scheduled_at);
                const daysUntilScheduled = differenceInDays(scheduledDate, new Date());
                
                return (
                  <motion.div
                    key={`notif-${notif.id}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (upcomingTasks.length + index) * 0.05 }}
                    onClick={() => {
                      if (notif.case_id) {
                        router.push(`/crm/cases/${notif.case_id}`);
                      } else {
                        router.push('/crm/notifications');
                      }
                    }}
                    className="p-2.5 bg-blue-50 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      <Bell className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            Notification: {notif.case_number || notif.case_id?.slice(0, 8)}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            Scheduled: {format(scheduledDate, 'MMM dd, yyyy')}
                            {daysUntilScheduled === 0 && ' (Today)'}
                            {daysUntilScheduled === 1 && ' (Tomorrow)'}
                            {daysUntilScheduled > 1 && ` (${daysUntilScheduled} days)`}
                          </span>
                        </div>
                        {notif.case_customer_name && (
                          <p className="text-xs text-gray-500 truncate">
                            Customer: {notif.case_customer_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            
            {/* Empty state */}
            {upcomingTasks.length === 0 && upcomingNotifications.length === 0 && (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600">No due dates to show</p>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Topper & Best Employee Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-yellow-600" />
          <h2 className="text-lg font-semibold text-gray-900">Recognition & Achievements</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Topper of the Month */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border-2 border-yellow-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5 text-yellow-600" />
              <h3 className="text-base font-semibold text-gray-900">Topper of the Month</h3>
            </div>
            <div className="relative w-full h-auto rounded-lg overflow-hidden bg-white shadow-md">
              <img
                src="/topperBestEmployee/Topper of the month (1)_260106_235918_2.jpeg"
                alt="Topper of the Month"
                className="w-full h-auto object-contain rounded-lg"
                onError={(e) => {
                  console.error('Failed to load Topper of the Month image');
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </motion.div>

          {/* Best Employee */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-semibold text-gray-900">Best Employee</h3>
            </div>
            <div className="relative w-full h-auto rounded-lg overflow-hidden bg-white shadow-md">
              <img
                src="/topperBestEmployee/Best Employee (1)_260106_235918_1.jpeg"
                alt="Best Employee"
                className="w-full h-auto object-contain rounded-lg"
                onError={(e) => {
                  console.error('Failed to load Best Employee image');
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

