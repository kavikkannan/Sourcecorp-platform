'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import Table from '@/components/Table';
import api from '@/lib/api';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  action?: string;
  resource_type?: string;
  resource_id?: string | null;
  error_message?: string;
  error_stack?: string;
  error_code?: string;
  path?: string;
  method?: string;
  user_name: string;
  user_email: string;
  ip_address: string | null;
  created_at: string;
  details?: any;
  log_type?: 'audit' | 'error';
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [logType, setLogType] = useState<'audit' | 'error' | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/audit-logs', {
        params: {
          limit,
          offset: page * limit,
          logType,
          month: selectedMonth,
        },
      });
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, logType, selectedMonth]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns = [
    {
      key: 'created_at',
      header: 'Timestamp',
      render: (log: AuditLog) => (
        <span className="text-sm">
          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (log: AuditLog) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          log.log_type === 'error' 
            ? 'bg-red-100 text-red-700' 
            : 'bg-blue-100 text-blue-700'
        }`}>
          {log.log_type === 'error' ? 'Error' : 'Audit'}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (log: AuditLog) => (
        <div className="text-sm">
          <div className="font-medium">{log.user_name || 'System'}</div>
          <div className="text-gray-500">{log.user_email}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: logType === 'error' ? 'Error' : 'Action',
      render: (log: AuditLog) => {
        if (log.log_type === 'error') {
          return (
            <div className="text-sm">
              <div className="font-medium text-red-700">{log.error_message || 'Unknown error'}</div>
              {log.error_code && (
                <div className="text-gray-500 text-xs">Code: {log.error_code}</div>
              )}
              {log.path && (
                <div className="text-gray-500 text-xs">{log.method} {log.path}</div>
              )}
            </div>
          );
        }
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
            {log.action}
          </span>
        );
      },
    },
    {
      key: 'resource',
      header: logType === 'error' ? 'Details' : 'Resource',
      render: (log: AuditLog) => {
        if (log.log_type === 'error') {
          return (
            <div className="text-sm">
              {log.error_stack && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-900">Stack Trace</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                    {log.error_stack}
                  </pre>
                </details>
              )}
            </div>
          );
        }
        return (
          <div className="text-sm">
            <div className="font-medium capitalize">{log.resource_type}</div>
            {log.resource_id && (
              <div className="text-gray-500 text-xs">{log.resource_id}</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'ip_address',
      header: 'IP Address',
      render: (log: AuditLog) => (
        <span className="text-sm text-gray-700">
          {log.ip_address || 'N/A'}
        </span>
      ),
    },
  ];

  if (loading) {
    return <div>Loading...</div>;
  }

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
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
    return options;
  };

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="View all system activity, changes, and errors"
      />

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Log Type
            </label>
            <select
              value={logType}
              onChange={(e) => {
                setLogType(e.target.value as 'audit' | 'error' | 'all');
                setPage(0);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Logs</option>
              <option value="audit">Audit Logs</option>
              <option value="error">Error Logs</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {getMonthOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Table
        columns={columns}
        data={logs}
        keyExtractor={(log) => log.id}
        emptyMessage="No logs found"
      />

      {total > limit && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} logs
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

