'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, Eye, Briefcase, X, Upload, Users, User, Filter, XCircle, FileSpreadsheet, Calendar } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Modal from '@/components/Modal';
import Dropdown from '@/components/Dropdown';
import { useAuth } from '@/contexts/AuthContext';
import { crmService, Case, CreateCaseData, LOAN_TYPES, CASE_STATUSES, getStatusColor, getStatusLabel } from '@/lib/crm';
import { hierarchyService, User as HierarchyUser } from '@/lib/hierarchy';
import { getErrorMessage } from '@/utils/errorHandler';
import { formatIndianCurrency } from '@/utils/formatNumber';
import { format } from 'date-fns';

export default function CasesPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [viewType, setViewType] = useState<'individual' | 'team'>('individual');
  const [subordinates, setSubordinates] = useState<HierarchyUser[]>([]);
  const [loadingSubordinates, setLoadingSubordinates] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [newCase, setNewCase] = useState<CreateCaseData>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    loan_type: 'PERSONAL',
    loan_amount: 0,
    source_type: null,
    documents: [],
  });
  const [loanAmountInput, setLoanAmountInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false);
  const [selectedCaseForDetails, setSelectedCaseForDetails] = useState<Case | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [templateFields, setTemplateFields] = useState<any[]>([]);

  // Export State
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportState, setExportState] = useState<{
    status: 'idle' | 'processing' | 'completed' | 'error';
    jobId?: string;
    progress: number;
    errorText?: string;
  }>({ status: 'idle', progress: 0 });
  const [exportScope, setExportScope] = useState<'selected' | 'my' | 'team'>('selected');

  const loadSubordinates = useCallback(async () => {
    if (viewType !== 'team') {
      setSubordinates([]);
      return;
    }
    try {
      setLoadingSubordinates(true);
      const allSubs = await hierarchyService.getAllMySubordinates();
      setSubordinates(allSubs);
    } catch (error) {
      console.error('Failed to load subordinates:', error);
      setSubordinates([]);
    } finally {
      setLoadingSubordinates(false);
    }
  }, [viewType]);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await crmService.getCases({
        status: statusFilter || undefined,
        view_type: viewType,
        created_by: userFilter || undefined,
        month: monthFilter || undefined,
        limit,
        offset: page * limit,
      });
      setCases(response.cases);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load cases:', error);
      const errorMessage = getErrorMessage(error);
      // Only show alert if it's not a permission issue (403) - those are handled by RBAC
      if (error instanceof Error && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status !== 403) {
          alert(`Failed to load cases: ${errorMessage}`);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, viewType, userFilter, monthFilter, limit]);

  useEffect(() => {
    loadSubordinates();
  }, [loadSubordinates]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    // Reset user filter when switching view types
    setUserFilter('');
    setPage(0);
  }, [viewType]);

  const handleCreateCase = async () => {
    // Clear previous errors
    setCreateError(null);
    setFieldErrors({});

    // Validate all fields
    const errors: Record<string, string> = {};

    // Validate Customer Name
    if (!newCase.customer_name.trim()) {
      errors.customer_name = 'Customer name is required';
    } else if (newCase.customer_name.trim().length < 2) {
      errors.customer_name = 'Customer name must be at least 2 characters';
    } else if (newCase.customer_name.trim().length > 100) {
      errors.customer_name = 'Customer name must be less than 100 characters';
    }

    // Validate Customer Email
    if (!newCase.customer_email.trim()) {
      errors.customer_email = 'Customer email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newCase.customer_email.trim())) {
        errors.customer_email = 'Please enter a valid email address';
      } else if (newCase.customer_email.trim().length > 255) {
        errors.customer_email = 'Email address is too long';
      }
    }

    // Validate Customer Phone
    if (!newCase.customer_phone.trim()) {
      errors.customer_phone = 'Customer phone number is required';
    } else {
      // Remove spaces, dashes, and parentheses for validation
      const phoneDigits = newCase.customer_phone.replace(/[\s\-\(\)]/g, '');
      // Allow 10-15 digits (international format)
      const phoneRegex = /^[+]?[0-9]{10,15}$/;
      if (!phoneRegex.test(phoneDigits)) {
        errors.customer_phone = 'Please enter a valid phone number (10-15 digits)';
      }
    }

    // Validate Loan Type
    if (!newCase.loan_type) {
      errors.loan_type = 'Loan type is required';
    }

    // Validate Loan Amount
    if (!loanAmountInput.trim()) {
      errors.loan_amount = 'Loan amount is required';
    } else {
      const loanAmount = parseFloat(loanAmountInput);
      if (isNaN(loanAmount)) {
        errors.loan_amount = 'Loan amount must be a valid number';
      } else if (loanAmount <= 0) {
        errors.loan_amount = 'Loan amount must be greater than 0';
      } else if (loanAmount > 999999999999) {
        errors.loan_amount = 'Loan amount is too large (maximum: 999,999,999,999)';
      } else if (loanAmountInput.split('.')[1]?.length > 2) {
        errors.loan_amount = 'Loan amount can have maximum 2 decimal places';
      }
    }

    // Validate file sizes if files are selected
    if (selectedFiles.length > 0) {
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = selectedFiles.filter((file: any) => file.size > maxFileSize);
      if (oversizedFiles.length > 0) {
        errors.documents = `Some files exceed 10MB limit: ${oversizedFiles.map((f: any) => f.name).join(', ')}`;
      }
    }

    // If there are errors, display them and return
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Focus on first error field
      const firstErrorField = Object.keys(errors)[0];
      setTimeout(() => {
        const element = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
        if (element) {
          element.focus();
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    const loanAmount = parseFloat(loanAmountInput);

    try {
      setCreating(true);
      setCreateError(null);
      await crmService.createCase({
        ...newCase,
        loan_amount: loanAmount,
        documents: selectedFiles.length > 0 ? selectedFiles : undefined,
      });
      setShowCreateModal(false);
      setNewCase({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        loan_type: 'PERSONAL',
        loan_amount: 0,
        source_type: null,
        documents: [],
      });
      setLoanAmountInput('');
      setSelectedFiles([]);
      setCreateError(null);
      setFieldErrors({});
      loadCases();
    } catch (error: any) {
      console.error('Failed to create case:', error);
      const errorMessage = getErrorMessage(error);
      setCreateError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const filteredCases = cases.filter(c =>
    c.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    // Load template fields
    crmService.getCustomerDetailTemplate().then(setTemplateFields).catch(() => {
      // If template fails to load, continue without filtering
      setTemplateFields([]);
    });
  }, []);

  const handleViewCustomerDetails = async (caseItem: Case) => {
    setSelectedCaseForDetails(caseItem);
    setShowCustomerDetailModal(true);
    setLoadingDetails(true);
    try {
      const details = await crmService.getCustomerDetailSheet(caseItem.id);
      setCustomerDetails(details);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to load customer details:', error);
        alert('Failed to load customer details');
      }
      setCustomerDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExportCases = async () => {
    try {
      setExportState((prev: any) => ({ ...prev, status: 'processing', progress: 0, errorText: undefined }));

      let idsToExport = selectedCases;
      if (idsToExport.length === 0) {
        setExportState((prev: any) => ({ ...prev, status: 'error', errorText: 'No cases selected' }));
        return;
      }

      const response = await crmService.exportCases(idsToExport);

      if (response.sync) {
        setExportState((prev: any) => ({ ...prev, status: 'completed', progress: 100, jobId: response.jobId }));
        await downloadExport(response.jobId);
      } else {
        setExportState((prev: any) => ({ ...prev, status: 'processing', progress: 0, jobId: response.jobId }));
        pollExportStatus(response.jobId);
      }
    } catch (error: any) {
      setExportState((prev: any) => ({
        ...prev,
        status: 'error',
        errorText: error.response?.data?.error || 'Failed to start export'
      }));
    }
  };

  const pollExportStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await crmService.getExportJobStatus(jobId);
        setExportState((prev: any) => ({ ...prev, progress: status.progress }));

        if (status.state === 'completed') {
          clearInterval(interval);
          setExportState((prev: any) => ({ ...prev, status: 'completed', progress: 100 }));
          await downloadExport(jobId);
        } else if (status.state === 'failed') {
          clearInterval(interval);
          setExportState((prev: any) => ({ ...prev, status: 'error', errorText: 'Export job failed' }));
        }
      } catch (error) {
        clearInterval(interval);
        setExportState((prev: any) => ({ ...prev, status: 'error', errorText: 'Failed to check status' }));
      }
    }, 2000);
  };

  const downloadExport = async (jobId: string) => {
    try {
      const blob = await crmService.downloadExportArchive(jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cases_export_${jobId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      setExportState((prev: any) => ({ ...prev, status: 'error', errorText: 'Failed to download file' }));
    }
  };


  return (
    <div>
      <PageHeader
        title="Loan Cases"
        description="Manage loan applications and cases"
      />

      <div className="space-y-6">
        {/* Filters and Actions */}
        <div className="space-y-4">
          {/* Main Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search by case number, customer name, or email..."
                  value={searchTerm}
                  onChange={(e: any) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Individual/Team Toggle */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => {
                    setViewType('individual');
                    setPage(0);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewType === 'individual'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <User className="w-4 h-4" />
                  Individual
                </button>
                <button
                  onClick={() => {
                    setViewType('team');
                    setPage(0);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewType === 'team'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <Users className="w-4 h-4" />
                  Team
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasPermission('crm.case.export') && selectedCases.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setExportScope('selected');
                    setShowExportModal(true);
                    setExportState({ status: 'idle', progress: 0 });
                  }}>
                  <Upload className="w-4 h-4 mr-2" />
                  Export Selected ({selectedCases.length})
                </Button>
              )}
              {hasPermission('crm.case.export') && selectedCases.length === 0 && (
                <Button
                  variant="secondary"
                  className="bg-white"
                  onClick={() => {
                    setExportScope(viewType === 'team' ? 'team' : 'my');
                    setShowExportModal(true);
                    setExportState({ status: 'idle', progress: 0 });
                  }}>
                  <Upload className="w-4 h-4 mr-2" />
                  Bulk Export
                </Button>
              )}
              {hasPermission('crm.case.create') && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Case
                </Button>
              )}
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Filter className="w-4 h-4" />
              Filters:
            </div>

            {/* Month Filter - Beautiful Design */}
            <div className="w-full sm:w-52">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
                <select
                  value={monthFilter}
                  onChange={(e: any) => {
                    setMonthFilter(e.target.value);
                    setPage(0);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <option value="">All Months</option>
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
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="w-full sm:w-48">
              <Select
                label=""
                value={statusFilter}
                onChange={(e: any) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                className="w-full"
                options={[
                  { value: '', label: 'All Statuses' },
                  ...CASE_STATUSES.map(status => ({ value: status.value, label: status.label }))
                ]}
              />
            </div>

            {/* User Filter - Only show in team view */}
            {viewType === 'team' && (
              <div className="w-full sm:w-56">
                <Select
                  label=""
                  value={userFilter}
                  onChange={(e: any) => {
                    setUserFilter(e.target.value);
                    setPage(0);
                  }}
                  className="w-full"
                  disabled={loadingSubordinates}
                  options={[
                    { value: '', label: loadingSubordinates ? 'Loading users...' : 'All Users' },
                    ...subordinates.map((user: any) => ({
                      value: user.id,
                      label: `${user.first_name} ${user.last_name}`
                    }))
                  ]}
                />
              </div>
            )}

            {/* Active Filters Display */}
            {(statusFilter || userFilter || monthFilter) && (
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                {monthFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(monthFilter + '-01'), 'MMMM yyyy')}
                    <button
                      onClick={() => {
                        setMonthFilter('');
                        setPage(0);
                      }}
                      className="hover:text-blue-900 transition-colors"
                      title="Clear month filter"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {statusFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                    Status: {CASE_STATUSES.find(s => s.value === statusFilter)?.label || statusFilter}
                    <button
                      onClick={() => {
                        setStatusFilter('');
                        setPage(0);
                      }}
                      className="hover:text-primary-900"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {userFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                    User: {subordinates.find(u => u.id === userFilter) ? `${subordinates.find(u => u.id === userFilter)!.first_name} ${subordinates.find(u => u.id === userFilter)!.last_name}` : 'Unknown'}
                    <button
                      onClick={() => {
                        setUserFilter('');
                        setPage(0);
                      }}
                      className="hover:text-primary-900"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setStatusFilter('');
                    setUserFilter('');
                    setMonthFilter('');
                    setPage(0);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cases Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600">Loading cases...</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No cases found</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter
                ? 'Try adjusting your filters'
                : 'Create your first case to get started'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-10">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        checked={filteredCases.length > 0 && selectedCases.length === filteredCases.length}
                        onChange={(e: any) => {
                          if (e.target.checked) setSelectedCases(filteredCases.map(c => c.id));
                          else setSelectedCases([]);
                        }}
                      />
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Case Number
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Loan Amount
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCases.map((caseItem: any) => (
                    <motion.tr
                      key={caseItem.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/crm/cases/${caseItem.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e: any) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          checked={selectedCases.includes(caseItem.id)}
                          onChange={(e: any) => {
                            if (e.target.checked) setSelectedCases(prev => [...prev, caseItem.id]);
                            else setSelectedCases(prev => prev.filter(id => id !== caseItem.id));
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-primary-600">
                          {caseItem.case_number}
                        </span>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {LOAN_TYPES.find(t => t.value === caseItem.loan_type)?.label || caseItem.loan_type}
                          {caseItem.source_type && ` • ${caseItem.source_type}`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {caseItem.customer_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {caseItem.customer_email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(caseItem.current_status)}`}>
                          {getStatusLabel(caseItem.current_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {caseItem.current_assignee ? (
                          <span className="text-sm text-gray-900">
                            {caseItem.current_assignee.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatIndianCurrency(caseItem.loan_amount)}
                        </span>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(caseItem.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e: any) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewCustomerDetails(caseItem)}
                            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="View Customer Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Dropdown
                            items={[
                              {
                                label: 'View Details',
                                onClick: () => router.push(`/crm/cases/${caseItem.id}`),
                                icon: <Eye className="w-4 h-4" />,
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing <span className="font-medium text-gray-900">{page * limit + 1}</span> to{' '}
                <span className="font-medium text-gray-900">{Math.min((page + 1) * limit, total)}</span> of{' '}
                <span className="font-medium text-gray-900">{total}</span> cases
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p: any) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p: any) => p + 1)}
                  disabled={(page + 1) * limit >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Case Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateError(null);
          setFieldErrors({});
          setSelectedFiles([]);
        }}
        title="Create New Case"
      >
        <div className="space-y-4">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{createError}</p>
            </div>
          )}
          <div>
            <Input
              name="customer_name"
              label="Customer Name"
              value={newCase.customer_name}
              onChange={(e: any) => {
                setNewCase({ ...newCase, customer_name: e.target.value });
                if (fieldErrors.customer_name) {
                  setFieldErrors({ ...fieldErrors, customer_name: '' });
                }
              }}
              required
              error={fieldErrors.customer_name}
            />
          </div>
          <div>
            <Input
              name="customer_email"
              label="Customer Email"
              type="email"
              value={newCase.customer_email}
              onChange={(e: any) => {
                setNewCase({ ...newCase, customer_email: e.target.value });
                if (fieldErrors.customer_email) {
                  setFieldErrors({ ...fieldErrors, customer_email: '' });
                }
              }}
              required
              error={fieldErrors.customer_email}
            />
          </div>
          <div>
            <Input
              name="customer_phone"
              label="Customer Phone"
              type="tel"
              value={newCase.customer_phone}
              onChange={(e: any) => {
                setNewCase({ ...newCase, customer_phone: e.target.value });
                if (fieldErrors.customer_phone) {
                  setFieldErrors({ ...fieldErrors, customer_phone: '' });
                }
              }}
              placeholder="+91 9876543210"
              required
              error={fieldErrors.customer_phone}
            />
          </div>
          <div>
            <Select
              name="loan_type"
              label="Loan Type"
              value={newCase.loan_type}
              onChange={(e: any) => {
                setNewCase({ ...newCase, loan_type: e.target.value });
                if (fieldErrors.loan_type) {
                  setFieldErrors({ ...fieldErrors, loan_type: '' });
                }
              }}
              required
              options={LOAN_TYPES.map(type => ({ value: type.value, label: type.label }))}
              error={fieldErrors.loan_type}
            />
          </div>
          <div>
            <Input
              name="loan_amount"
              label="Loan Amount"
              type="number"
              step="0.01"
              min="0"
              value={loanAmountInput}
              onChange={(e: any) => {
                setLoanAmountInput(e.target.value);
                const amount = parseFloat(e.target.value);
                if (!isNaN(amount)) {
                  setNewCase({ ...newCase, loan_amount: amount });
                }
                if (fieldErrors.loan_amount) {
                  setFieldErrors({ ...fieldErrors, loan_amount: '' });
                }
              }}
              placeholder="0.00"
              required
              error={fieldErrors.loan_amount}
            />
            <p className="mt-1 text-xs text-gray-500">Enter amount in rupees (supports decimal values)</p>
          </div>
          <Select
            label="Source Type"
            value={newCase.source_type || ''}
            onChange={(e: any) => setNewCase({ ...newCase, source_type: e.target.value as 'DSA' | 'DST' | null || null })}
            options={[
              { value: '', label: 'Select Source Type (Optional)' },
              { value: 'DSA', label: 'DSA' },
              { value: 'DST', label: 'DST' },
            ]}
          />

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Documents (Optional)
            </label>
            {fieldErrors.documents && (
              <p className="text-sm text-red-600 mb-2">{fieldErrors.documents}</p>
            )}
            <div className="space-y-2">
              <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg appearance-none cursor-pointer hover:border-primary-500 focus:outline-none">
                <span className="flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-600">
                    Click to upload or drag and drop
                  </span>
                </span>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,.pdf,.xlsx,.xls,.doc,.docx"
                  onChange={(e: any) => {
                    const files = Array.from(e.target.files || []);
                    const maxFileSize = 10 * 1024 * 1024; // 10MB
                    const validFiles: File[] = [];
                    const errors: string[] = [];

                    files.forEach((file: any) => {
                      if (file.size > maxFileSize) {
                        errors.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds 10MB limit`);
                      } else {
                        validFiles.push(file);
                      }
                    });

                    if (errors.length > 0) {
                      setFieldErrors({ ...fieldErrors, documents: errors.join(', ') });
                    } else if (fieldErrors.documents) {
                      const newErrors = { ...fieldErrors };
                      delete newErrors.documents;
                      setFieldErrors(newErrors);
                    }

                    setSelectedFiles((prev) => [...prev, ...validFiles]);
                  }}
                />
              </label>
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-700 truncate flex-1">
                        {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500">
                Supported formats: Images, PDF, Excel, Word (Max 10MB per file)
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              className="flex-1"
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCase}
              className="flex-1"
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create Case'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Customer Details Modal */}
      <Modal
        isOpen={showCustomerDetailModal}
        onClose={() => {
          setShowCustomerDetailModal(false);
          setSelectedCaseForDetails(null);
          setCustomerDetails(null);
        }}
        title={selectedCaseForDetails ? `Customer Details - ${selectedCaseForDetails.case_number}` : 'Customer Details'}
      >
        {loadingDetails ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600">Loading customer details...</p>
          </div>
        ) : customerDetails ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                const visibleFields = templateFields.length > 0
                  ? templateFields.filter((f: any) => f.is_visible).map(f => f.field_key)
                  : null;

                return Object.entries(customerDetails.detail_data || {})
                  .filter(([key]) => {
                    if (key.startsWith('raw_')) return false;
                    if (visibleFields === null) return true; // Show all if no template
                    return visibleFields.includes(key);
                  })
                  .sort(([keyA], [keyB]) => {
                    if (visibleFields === null) return 0;
                    const orderA = templateFields.find(f => f.field_key === keyA)?.display_order || 999;
                    const orderB = templateFields.find(f => f.field_key === keyB)?.display_order || 999;
                    return orderA - orderB;
                  })
                  .map(([key, value]: [string, any]) => {
                    const templateField = templateFields.find(f => f.field_key === key);
                    const formattedKey = templateField?.field_label || key
                      .split('_')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');

                    return (
                      <div key={key} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">{formattedKey}</p>
                        <p className="text-sm font-medium text-gray-900">{value || 'Not mentioned'}</p>
                      </div>
                    );
                  });
              })()}
            </div>
            {Object.keys(customerDetails.detail_data || {}).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No customer details available
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No customer detail sheet uploaded for this case
          </div>
        )}
      </Modal>

      {/* Export Options Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => {
          if (exportState.status !== 'processing') {
            setShowExportModal(false);
            setExportState({ status: 'idle', progress: 0 });
          }
        }}
        title="Export Cases"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You are about to export {selectedCases.length} case(s). This includes case details, notes, timeline events, notifications, and all uploaded documents in a ZIP archive.
          </p>

          {exportState.errorText && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{exportState.errorText}</p>
            </div>
          )}

          {exportState.status === 'processing' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Generating Archive...</span>
                <span>{exportState.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${exportState.progress}%` }}></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Please wait while we gather and package the files. Large exports may take several minutes.
              </p>
            </div>
          )}

          {exportState.status === 'completed' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <FileSpreadsheet className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-green-800 font-medium">Export Completed Successfully</p>
              <p className="text-sm text-green-700 mt-1">Your download should begin automatically.</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowExportModal(false);
                setExportState({ status: 'idle', progress: 0 });
              }}
              className="flex-1"
              disabled={exportState.status === 'processing'}
            >
              {exportState.status === 'completed' ? 'Close' : 'Cancel'}
            </Button>

            {exportState.status === 'idle' && (
              <Button
                onClick={handleExportCases}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Start Export
              </Button>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
}

