'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import Table from '@/components/Table';
import api from '@/lib/api';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  user_name: string;
  user_email: string;
  ip_address: string | null;
  created_at: string;
  details: any;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/audit-logs', {
        params: {
          limit,
          offset: page * limit,
        },
      });
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

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
      header: 'Action',
      render: (log: AuditLog) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
          {log.action}
        </span>
      ),
    },
    {
      key: 'resource',
      header: 'Resource',
      render: (log: AuditLog) => (
        <div className="text-sm">
          <div className="font-medium capitalize">{log.resource_type}</div>
          {log.resource_id && (
            <div className="text-gray-500 text-xs">{log.resource_id}</div>
          )}
        </div>
      ),
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

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="View all system activity and changes"
      />

      <Table
        columns={columns}
        data={logs}
        keyExtractor={(log) => log.id}
        emptyMessage="No audit logs found"
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

