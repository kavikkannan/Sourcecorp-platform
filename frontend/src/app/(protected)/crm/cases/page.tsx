'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, Eye, Briefcase, X, Upload } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Modal from '@/components/Modal';
import Dropdown from '@/components/Dropdown';
import { useAuth } from '@/contexts/AuthContext';
import { crmService, Case, CreateCaseData, LOAN_TYPES, CASE_STATUSES, getStatusColor, getStatusLabel } from '@/lib/crm';
import { getErrorMessage } from '@/utils/errorHandler';

export default function CasesPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await crmService.getCases({
        status: statusFilter || undefined,
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
  }, [page, statusFilter, limit]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleCreateCase = async () => {
    // Validate required fields
    if (!newCase.customer_name.trim() || !newCase.customer_email.trim() || !newCase.customer_phone.trim()) {
      setCreateError('Please fill in all required fields');
      return;
    }

    const loanAmount = parseFloat(loanAmountInput);
    if (!loanAmountInput || isNaN(loanAmount) || loanAmount <= 0) {
      setCreateError('Loan amount must be a valid number greater than 0');
      return;
    }

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

  return (
    <div>
      <PageHeader
        title="Loan Cases"
        description="Manage loan applications and cases"
      />

      <div className="space-y-6">
        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search by case number, customer name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                label=""
                value={statusFilter}
                onChange={(e) => {
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
          </div>

          {hasPermission('crm.case.create') && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Case
            </Button>
          )}
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
                  {filteredCases.map((caseItem) => (
                    <motion.tr
                      key={caseItem.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/crm/cases/${caseItem.id}`)}
                    >
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
                          ${caseItem.loan_amount.toLocaleString()}
                        </span>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(caseItem.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          items={[
                            {
                              label: 'View Details',
                              onClick: () => router.push(`/crm/cases/${caseItem.id}`),
                              icon: <Eye className="w-4 h-4" />,
                            },
                          ]}
                        />
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
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage(p => p + 1)}
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
          <Input
            label="Customer Name"
            value={newCase.customer_name}
            onChange={(e) => setNewCase({ ...newCase, customer_name: e.target.value })}
            required
          />
          <Input
            label="Customer Email"
            type="email"
            value={newCase.customer_email}
            onChange={(e) => setNewCase({ ...newCase, customer_email: e.target.value })}
            required
          />
          <Input
            label="Customer Phone"
            value={newCase.customer_phone}
            onChange={(e) => setNewCase({ ...newCase, customer_phone: e.target.value })}
            required
          />
          <Select
            label="Loan Type"
            value={newCase.loan_type}
            onChange={(e) => setNewCase({ ...newCase, loan_type: e.target.value })}
            required
            options={LOAN_TYPES.map(type => ({ value: type.value, label: type.label }))}
          />
          <Input
            label="Loan Amount"
            type="number"
            step="0.01"
            min="0"
            value={loanAmountInput}
            onChange={(e) => {
              setLoanAmountInput(e.target.value);
              const amount = parseFloat(e.target.value);
              if (!isNaN(amount)) {
                setNewCase({ ...newCase, loan_amount: amount });
              }
            }}
            placeholder="0.00"
            required
          />
          <Select
            label="Source Type"
            value={newCase.source_type || ''}
            onChange={(e) => setNewCase({ ...newCase, source_type: e.target.value as 'DSA' | 'DST' | null || null })}
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
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setSelectedFiles((prev) => [...prev, ...files]);
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
    </div>
  );
}

