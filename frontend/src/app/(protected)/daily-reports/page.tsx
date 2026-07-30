'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Calendar,
  FileText,
  TrendingUp,
  Users,
  IndianRupee,
  CheckCircle,
  ArrowLeft,
  Loader2,
  User,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { useAuth } from '@/contexts/AuthContext';
import {
  dailyReportService,
  DailyReport,
  DailyReportPerUser,
  DailyReportTotals,
  openingFields,
  closingFields,
} from '@/lib/dailyReports';
import { hierarchyService } from '@/lib/hierarchy';
import { formatIndianCurrency } from '@/utils/formatNumber';
import { format, parseISO } from 'date-fns';

interface FilterUser {
  id: string;
  first_name: string;
  last_name: string;
}

export default function DailyReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const canViewSubordinates = hasPermission('daily_report.view_subordinates');

  const [selectedMonth, setSelectedMonth] = useState<string>(
    searchParams.get('month') ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedUser, setSelectedUser] = useState<string>(searchParams.get('user') || '');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [totals, setTotals] = useState<DailyReportTotals | null>(null);
  const [perUser, setPerUser] = useState<DailyReportPerUser[]>([]);
  const [subordinates, setSubordinates] = useState<FilterUser[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSubordinates = useCallback(async () => {
    if (!canViewSubordinates) return;
    try {
      const data = await hierarchyService.getAllMySubordinates();
      setSubordinates(data);
    } catch (error) {
      console.error('Failed to load subordinates:', error);
    }
  }, [canViewSubordinates]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, reportsRes] = await Promise.all([
        dailyReportService.getStats(selectedMonth),
        dailyReportService.getReports({
          month: selectedMonth,
          user_id: selectedUser || undefined,
          limit: 100,
        }),
      ]);
      setTotals(statsRes.totals);
      setPerUser(statsRes.perUser);
      setReports(reportsRes.reports);
    } catch (error) {
      console.error('Failed to load daily reports:', error);
      alert('Failed to load daily reports');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedUser]);

  useEffect(() => {
    loadSubordinates();
  }, [loadSubordinates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedMonth) params.set('month', selectedMonth);
    if (selectedUser) params.set('user', selectedUser);
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    if (newUrl !== `${pathname}${window.location.search}`) {
      router.replace(newUrl, { scroll: false });
    }
  }, [selectedMonth, selectedUser, pathname, router]);

  const monthOptions = (() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = format(date, 'MMMM yyyy');
      options.push({ value, label });
    }
    return options;
  })();

  const renderStatCard = (
    label: string,
    value: string | number,
    icon: React.ReactNode,
    color: string
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg p-4 border-2 ${color}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Reports & Stats"
        description="View individual and subordinate daily sales reports"
        action={
          <Link href="/daily-reports/submit">
            <Button variant="secondary" icon={<FileText className="w-4 h-4" />}>
              Submit Report
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-56">
          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none cursor-pointer"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canViewSubordinates && (
          <div className="w-full sm:w-72">
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <Select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              options={[
                { value: '', label: 'All (me + subordinates)' },
                { value: user?.id || '', label: `${user?.firstName || 'Me'} (You)` },
                ...subordinates.map((u) => ({
                  value: u.id,
                  label: `${u.first_name} ${u.last_name}`,
                })),
              ]}
            />
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {loading && !totals ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : totals ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderStatCard('Reports Submitted', totals.reports, <FileText className="w-5 h-5 text-blue-700" />, 'bg-blue-100 border-blue-300')}
          {renderStatCard('Total Logins', totals.closingTotalLogins, <TrendingUp className="w-5 h-5 text-purple-700" />, 'bg-purple-100 border-purple-300')}
          {renderStatCard('Total Login Volume', formatIndianCurrency(totals.closingTotalLoginVolume), <IndianRupee className="w-5 h-5 text-indigo-700" />, 'bg-indigo-100 border-indigo-300')}
          {renderStatCard('Total Approvals', formatIndianCurrency(totals.closingTotalApprovals), <CheckCircle className="w-5 h-5 text-green-700" />, 'bg-green-100 border-green-300')}
          {renderStatCard('Total Disbursed', formatIndianCurrency(totals.closingTotalDisbursed), <IndianRupee className="w-5 h-5 text-teal-700" />, 'bg-teal-100 border-teal-300')}
          {renderStatCard("Today's Conversions", totals.closingTodaysConversion, <TrendingUp className="w-5 h-5 text-orange-700" />, 'bg-orange-100 border-orange-300')}
          {renderStatCard("Today's Callbacks", totals.closingTodaysCallback, <Users className="w-5 h-5 text-pink-700" />, 'bg-pink-100 border-pink-300')}
          {renderStatCard('Opening Disbursed', formatIndianCurrency(totals.openingDisbursed), <IndianRupee className="w-5 h-5 text-cyan-700" />, 'bg-cyan-100 border-cyan-300')}
        </div>
      ) : null}

      {/* Per-user breakdown for managers */}
      {canViewSubordinates && perUser.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              Per Employee Summary
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Reports</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Logins</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Login Volume</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Approvals</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Disbursed</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {perUser.map((item) => (
                  <tr key={item.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.first_name} {item.last_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{item.reports}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{item.closingTotalLogins}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{formatIndianCurrency(item.closingTotalLoginVolume)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{formatIndianCurrency(item.closingTotalApprovals)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{formatIndianCurrency(item.closingTotalDisbursed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reports table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            Report Entries
          </h2>
          <span className="text-sm text-gray-500">{reports.length} entries</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No reports found for the selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  {canViewSubordinates && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employee</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Instocks Login</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Instocks Volume</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Logins</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Login Volume</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Approvals</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Disbursed</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Day Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {format(parseISO(report.report_date), 'dd MMM yyyy')}
                    </td>
                    {canViewSubordinates && (
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {report.user ? `${report.user.first_name} ${report.user.last_name}` : report.user_id.slice(0, 8)}
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{report.opening_instocks_login}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{formatIndianCurrency(report.opening_instocks_volume)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{report.closing_total_logins}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{formatIndianCurrency(report.closing_total_login_volume)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{formatIndianCurrency(report.closing_total_approvals)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{formatIndianCurrency(report.closing_total_disbursed)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        report.closing_day_status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {report.closing_day_status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
