'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import { adminExportService, AdminCase, AdminCasesFilters } from '@/lib/adminExports';
import { getErrorMessage } from '@/utils/errorHandler';
import { formatIndianCurrency } from '@/utils/formatNumber';
import { LOAN_TYPES, CASE_STATUSES, CASE_PRIORITIES, getStatusColor, getStatusLabel, getPriorityColor } from '@/lib/crm';
import { format } from 'date-fns';
import { Search, Download, Archive, Filter, Calendar, Loader2, CheckSquare, Square, X } from 'lucide-react';

const ROW_LIMIT = 25;

export default function CaseExportsPage() {
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [filters, setFilters] = useState<AdminCasesFilters>({
    status: '',
    loan_type: '',
    priority: '',
    month: '',
    search: '',
    created_from: '',
    created_to: '',
  });

  const [selectedCases, setSelectedCases] = useState<string[]>([]);

  const [exportState, setExportState] = useState<{
    status: 'idle' | 'processing' | 'completed' | 'error';
    jobId?: string;
    progress: number;
    current?: number;
    total?: number;
    errorText?: string;
  }>({ status: 'idle', progress: 0 });

  const [showExportModal, setShowExportModal] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const buildQueryFilters = useCallback(() => {
    const query: AdminCasesFilters = {};
    if (filters.status) query.status = filters.status;
    if (filters.loan_type) query.loan_type = filters.loan_type;
    if (filters.priority) query.priority = filters.priority;
    if (filters.month) query.month = filters.month;
    if (filters.search?.trim()) query.search = filters.search.trim();
    if (filters.created_from) query.created_from = filters.created_from;
    if (filters.created_to) query.created_to = filters.created_to;
    return query;
  }, [filters]);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      const query = buildQueryFilters();
      const result = await adminExportService.getAdminCases({
        ...query,
        limit: ROW_LIMIT,
        offset,
      });
      setCases(result.cases);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load cases:', error);
      alert(`Failed to load cases: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [offset, buildQueryFilters]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleFilterChange = (key: keyof AdminCasesFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOffset(0);
    setSelectedCases([]);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      loan_type: '',
      priority: '',
      month: '',
      search: '',
      created_from: '',
      created_to: '',
    });
    setOffset(0);
    setSelectedCases([]);
  };

  const toggleCaseSelection = (caseId: string) => {
    setSelectedCases((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  };

  const toggleAll = () => {
    const visibleIds = cases.map((c) => c.id);
    const allSelected = visibleIds.every((id) => selectedCases.includes(id));
    if (allSelected) {
      setSelectedCases((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedCases((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const startExport = async (payload: {
    caseIds?: string[];
    filters?: AdminCasesFilters;
    exportAll?: boolean;
  }, knownTotal?: number) => {
    try {
      setExportState({ status: 'processing', progress: 0, total: knownTotal, current: 0 });
      setShowExportModal(true);

      const response = await adminExportService.startAdminExport(payload);

      if (response.status === 'completed') {
        setExportState((prev) => ({
          ...prev,
          status: 'completed',
          progress: 100,
          current: knownTotal,
          total: knownTotal,
          jobId: response.jobId,
        }));
        await downloadExport(response.jobId);
      } else {
        setExportState((prev) => ({ ...prev, jobId: response.jobId }));
        pollExportStatus(response.jobId);
      }
    } catch (error) {
      setExportState((prev) => ({
        ...prev,
        status: 'error',
        errorText: getErrorMessage(error) || 'Failed to start export',
      }));
      setShowExportModal(true);
    }
  };

  const extractProgress = (progress: number | { progress: number; current: number; total: number }) => {
    if (typeof progress === 'number') {
      return { progress, current: undefined, total: undefined };
    }
    return {
      progress: progress.progress,
      current: progress.current,
      total: progress.total,
    };
  };

  const pollExportStatus = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const status = await adminExportService.getExportJobStatus(jobId);
        const progressInfo = extractProgress(status.progress);
        setExportState((prev) => ({
          ...prev,
          progress: progressInfo.progress,
          current: progressInfo.current,
          total: progressInfo.total,
        }));

        const isCompleted = status.status === 'completed' || status.state === 'completed';
        const isFailed = status.status === 'failed' || status.state === 'failed';

        if (isCompleted) {
          if (pollRef.current) clearInterval(pollRef.current);
          setExportState((prev) => ({
            ...prev,
            status: 'completed',
            progress: 100,
            current: progressInfo.total,
            total: progressInfo.total,
          }));
          await downloadExport(jobId);
        } else if (isFailed) {
          if (pollRef.current) clearInterval(pollRef.current);
          setExportState((prev) => ({
            ...prev,
            status: 'error',
            errorText: status.error || 'Export job failed',
          }));
        }
      } catch (error) {
        if (pollRef.current) clearInterval(pollRef.current);
        setExportState((prev) => ({
          ...prev,
          status: 'error',
          errorText: 'Failed to check export status',
        }));
      }
    }, 2000);
  };

  const downloadExport = async (jobId: string) => {
    try {
      const blob = await adminExportService.downloadExportArchive(jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-case-export-${jobId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      setExportState((prev) => ({
        ...prev,
        status: 'error',
        errorText: 'Failed to download archive',
      }));
    }
  };

  const handleExportSelected = () => {
    if (selectedCases.length === 0) {
      alert('Please select at least one case');
      return;
    }
    startExport({ caseIds: selectedCases }, selectedCases.length);
  };

  const handleExportMatching = () => {
    startExport({ filters: buildQueryFilters() }, total);
  };

  const handleExportAll = () => {
    startExport({ exportAll: true }, total);
  };

  const activeFilterCount = Object.values(filters).filter((v) => v && v !== '').length;

  const columns = [
    {
      key: 'select',
      header: 'Select',
      render: (caseItem: AdminCase) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleCaseSelection(caseItem.id);
          }}
          className="text-gray-700 hover:text-primary-600"
        >
          {selectedCases.includes(caseItem.id) ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>
      ),
    },
    {
      key: 'case_number',
      header: 'Case Number',
      render: (caseItem: AdminCase) => (
        <div>
          <div className="text-sm font-semibold text-primary-600">{caseItem.case_number}</div>
          <div className="text-xs text-gray-500">
            {LOAN_TYPES.find((t) => t.value === caseItem.loan_type)?.label || caseItem.loan_type}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (caseItem: AdminCase) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{caseItem.customer_name}</div>
          <div className="text-xs text-gray-500">{caseItem.customer_email}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (caseItem: AdminCase) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(caseItem.current_status)}`}>
          {getStatusLabel(caseItem.current_status)}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (caseItem: AdminCase) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(caseItem.priority)}`}>
          {CASE_PRIORITIES.find((p) => p.value === caseItem.priority)?.label || caseItem.priority}
        </span>
      ),
    },
    {
      key: 'assigned',
      header: 'Assigned To',
      render: (caseItem: AdminCase) => (
        <span className="text-sm text-gray-700">
          {caseItem.current_assignee?.name || <span className="text-gray-400 italic">Unassigned</span>}
        </span>
      ),
    },
    {
      key: 'loan_amount',
      header: 'Loan Amount',
      render: (caseItem: AdminCase) => (
        <span className="text-sm font-medium text-gray-900">{formatIndianCurrency(caseItem.loan_amount)}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (caseItem: AdminCase) => (
        <span className="text-sm text-gray-600">{format(new Date(caseItem.created_at), 'MMM dd, yyyy')}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Case Export Manager" description="Export case archives with advanced filters and admin override" />

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter className="w-4 h-4" />
            Filters {activeFilterCount > 0 && <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs">{activeFilterCount}</span>}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-gray-600 hover:text-gray-900 underline flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Case, customer, email, phone"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
            >
              <option value="">All Statuses</option>
              {CASE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Loan Type</label>
            <select
              value={filters.loan_type}
              onChange={(e) => handleFilterChange('loan_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
            >
              <option value="">All Loan Types</option>
              {LOAN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
            >
              <option value="">All Priorities</option>
              {CASE_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
              <select
                value={filters.month}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white appearance-none cursor-pointer"
              >
                <option value="">All Months</option>
                {(() => {
                  const options = [];
                  const now = new Date();
                  for (let i = 0; i < 24; i++) {
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
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Created From</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="date"
                value={filters.created_from}
                onChange={(e) => handleFilterChange('created_from', e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Created To</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="date"
                value={filters.created_to}
                onChange={(e) => handleFilterChange('created_to', e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="text-sm text-gray-600">
          {selectedCases.length > 0 ? (
            <span className="font-medium text-primary-600">{selectedCases.length} selected</span>
          ) : (
            <span>{total} cases match current filters</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={handleExportSelected} disabled={selectedCases.length === 0} icon={<Archive className="w-4 h-4" />}>
            Export Selected
          </Button>
          <Button variant="secondary" onClick={handleExportMatching} icon={<Filter className="w-4 h-4" />}>
            Export Matching
          </Button>
          <Button onClick={handleExportAll} icon={<Download className="w-4 h-4" />}>
            Export All Cases
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading cases...</p>
        </div>
      ) : (
        <>
          <Table columns={columns} data={cases} keyExtractor={(c) => c.id} emptyMessage="No cases found matching the filters" />

          {total > ROW_LIMIT && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {offset + 1} to {Math.min(offset + ROW_LIMIT, total)} of {total} cases
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOffset((o) => Math.max(0, o - ROW_LIMIT))} disabled={offset === 0}>
                  Previous
                </Button>
                <Button variant="secondary" onClick={() => setOffset((o) => o + ROW_LIMIT)} disabled={offset + ROW_LIMIT >= total}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Export Progress Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          if (pollRef.current) clearInterval(pollRef.current);
        }}
        title="Export Cases"
      >
        <div className="space-y-4 p-2">
          {exportState.status === 'processing' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                  <span className="text-sm text-gray-700">
                    {exportState.total ? (
                      <>Processing case {exportState.current ?? 0} of {exportState.total}</>
                    ) : (
                      <>Preparing case archive...</>
                    )}
                  </span>
                </div>
                <span className="text-sm font-medium text-primary-600">{exportState.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${exportState.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-right">
                {exportState.total ? `${exportState.current ?? 0} / ${exportState.total} cases` : `${exportState.progress}%`}
              </p>
            </>
          )}

          {exportState.status === 'completed' && (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Download className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm text-gray-700">Export completed successfully.</p>
              <Button onClick={() => exportState.jobId && downloadExport(exportState.jobId)} icon={<Download className="w-4 h-4" />}>
                Download Again
              </Button>
            </div>
          )}

          {exportState.status === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{exportState.errorText || 'Export failed'}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
