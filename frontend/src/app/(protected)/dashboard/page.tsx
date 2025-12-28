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
  DollarSign,
  Award,
  Building2,
  Info,
} from 'lucide-react';
import api from '@/lib/api';
import { crmService, Case, CASE_STATUSES } from '@/lib/crm';
import { format } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  author_name: string;
  created_at: string;
}

interface CaseStatistics {
  newCases: number;
  loginCases: number; // ASSIGNED cases
  underwritingAmount: number; // UNDER_REVIEW cases amount
  approvedAmount: number;
  disbursedAmount: number;
  rejectedAmount: number;
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'individual' | 'team'>('individual');
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
  const [loading, setLoading] = useState(true);

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
        case 'ASSIGNED':
          stats.loginCases++;
          break;
        case 'UNDER_REVIEW':
          stats.underwritingAmount += caseItem.loan_amount;
          break;
        case 'APPROVED':
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
    try {
      setLoading(true);
      const promises: Promise<any>[] = [];

      // Load cases (most users should have access)
      if (hasPermission('crm.case.view')) {
        promises.push(
          crmService.getCases({ limit: 1000 }).then((res) => {
            const cases = res.cases;
            setAllCases(cases);

            // Individual stats (cases assigned to current user)
            const myCases = cases.filter((c: Case) => 
              c.current_assignee?.id === user?.id
            );
            const individualStats = calculateStatistics(myCases, false);
            setIndividualStats(individualStats);

            // Team stats (all cases user can see - for team members, this might be team cases)
            // For now, if user has team permissions, show all cases as "team"
            const teamStats = calculateStatistics(cases, true);
            setTeamStats(teamStats);

            return { success: true };
          }).catch(() => ({ success: false }))
        );
      }

      // Load announcements (try to load, handle permission errors gracefully)
      promises.push(
        api.get('/admin/announcements', { params: { activeOnly: 'true' } })
          .then((res) => {
            const activeAnnouncements = Array.isArray(res.data)
              ? res.data.filter((a: Announcement) => a.is_active)
              : [];
            setAnnouncements(activeAnnouncements.slice(0, 5)); // Show latest 5
            return { success: true };
          })
          .catch(() => {
            // If no permission, just don't show announcements
            setAnnouncements([]);
            return { success: false };
          })
      );

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, hasPermission, calculateStatistics]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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
            Welcome to SourceCorp Platform
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Case Statistics</h2>
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
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-900">New Cases</p>
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {loading ? '...' : currentStats.newCases}
              </p>
              <p className="text-xs text-blue-700 mt-1">Count</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-purple-900">Login Cases</p>
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {loading ? '...' : currentStats.loginCases}
              </p>
              <p className="text-xs text-purple-700 mt-1">Count</p>
            </div>

            {/* AMOUNT Cards */}
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-indigo-900">Underwriting Amount</p>
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-indigo-900">
                {loading ? '...' : formatAmount(currentStats.underwritingAmount)}
              </p>
              <p className="text-xs text-indigo-700 mt-1">Amount</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-green-900">Approved Amount</p>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">
                {loading ? '...' : formatAmount(currentStats.approvedAmount)}
              </p>
              <p className="text-xs text-green-700 mt-1">Amount</p>
            </div>

            <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-teal-900">Disbursed Amount</p>
                <DollarSign className="w-5 h-5 text-teal-600" />
              </div>
              <p className="text-2xl font-bold text-teal-900">
                {loading ? '...' : formatAmount(currentStats.disbursedAmount)}
              </p>
              <p className="text-xs text-teal-700 mt-1">Amount</p>
            </div>

            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-red-900">Rejected Amount</p>
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-900">
                {loading ? '...' : formatAmount(currentStats.rejectedAmount)}
              </p>
              <p className="text-xs text-red-700 mt-1">Amount</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Announcements Section */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {announcements.map((announcement, index) => (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{announcement.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{announcement.content}</p>
                    <p className="text-xs text-gray-500">
                      {announcement.author_name} • {format(new Date(announcement.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Banking Updates Section */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Banking Updates</h2>
          </div>
          <div className="space-y-2">
            {announcements
              .filter((a) => 
                a.title.toLowerCase().includes('interest') ||
                a.title.toLowerCase().includes('rate') ||
                a.title.toLowerCase().includes('policy') ||
                a.title.toLowerCase().includes('loan product')
              )
              .slice(0, 3)
              .map((update, index) => (
                <motion.div
                  key={update.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"
                >
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{update.title}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(update.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </motion.div>
              ))}
            {announcements.filter((a) => 
              a.title.toLowerCase().includes('interest') ||
              a.title.toLowerCase().includes('rate') ||
              a.title.toLowerCase().includes('policy') ||
              a.title.toLowerCase().includes('loan product')
            ).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No banking updates available</p>
            )}
          </div>
        </div>
      )}

      {/* Employee Recognition Section */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-sm border border-purple-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Recognition & Highlights</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Employee of the Month</p>
                <p className="text-xs text-gray-500 mt-1">Recognition program coming soon</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Top Performers</p>
                <p className="text-xs text-gray-500 mt-1">Team achievements will appear here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

