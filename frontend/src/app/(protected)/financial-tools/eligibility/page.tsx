'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calculator, CheckCircle, XCircle, Download, Search, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import FinancialToolsNav from '@/components/FinancialToolsNav';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { financeService, downloadBlob } from '@/lib/finance';
import { crmService, Case, LOAN_TYPES } from '@/lib/crm';

export default function EligibilityPage() {
  const { hasPermission } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [calculation, setCalculation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await crmService.getCases({ limit: 100 });
      setCases(response.cases);
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEligibility = useCallback(async () => {
    if (!selectedCase) return;
    try {
      const result = await financeService.getEligibility(selectedCase.id);
      setCalculation(result);
      setMonthlyIncome(result.monthly_income.toString());
      setRequestedAmount(result.requested_amount.toString());
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to load eligibility:', error);
      }
    }
  }, [selectedCase]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (selectedCase) {
      loadEligibility();
    }
  }, [selectedCase, loadEligibility]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCalculate = async () => {
    if (!selectedCase || !monthlyIncome || !requestedAmount) {
      alert('Please select a case and enter both monthly income and requested amount');
      return;
    }

    try {
      setCalculating(true);
      const result = await financeService.calculateEligibility({
        case_id: selectedCase.id,
        monthly_income: parseFloat(monthlyIncome),
        requested_amount: parseFloat(requestedAmount),
      });
      setCalculation(result);
      await loadCases(); // Refresh cases to show updated info
    } catch (error: any) {
      console.error('Failed to calculate eligibility:', error);
      alert(error.response?.data?.error || 'Failed to calculate eligibility');
    } finally {
      setCalculating(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!selectedCase) return;
    try {
      const blob = await financeService.exportEligibility(selectedCase.id, format);
      const extension = format === 'xlsx' ? 'xlsx' : format;
      downloadBlob(blob, `eligibility-${selectedCase.case_number}.${extension}`);
    } catch (error: any) {
      console.error('Failed to export:', error);
      alert(error.response?.data?.error || 'Failed to export');
    }
  };

  const filteredCases = cases.filter(c =>
    c.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Top 3 cases for initial display
  const topCases = cases.slice(0, 3);
  
  // Cases to display: if searching, show filtered results; if no search and no selection, show top 3
  const displayCases = searchTerm ? filteredCases : (selectedCase ? [] : topCases);

  return (
    <div>
      <PageHeader
        title="Eligibility Calculator"
        description="Calculate loan eligibility based on income and requested amount"
      />

      <FinancialToolsNav />

      <div className="space-y-6">
        {/* Case Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 overflow-visible">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Case</h2>
          <div className="relative overflow-visible" ref={searchRef}>
            <Input
              type="text"
              placeholder="Search cases by case number or customer name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => {
                if (!selectedCase) {
                  setShowSearchResults(true);
                }
              }}
              icon={<Search className="w-4 h-4" />}
            />
            
            {/* Search Results Dropdown */}
            {showSearchResults && !selectedCase && displayCases.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute z-[100] w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
              >
                {displayCases.map((caseItem) => (
                  <button
                    key={caseItem.id}
                    onClick={() => {
                      setSelectedCase(caseItem);
                      setSearchTerm('');
                      setShowSearchResults(false);
                    }}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <p className="font-medium text-gray-900">{caseItem.case_number}</p>
                    <p className="text-sm text-gray-600">{caseItem.customer_name}</p>
                    <p className="text-xs text-gray-500">{caseItem.loan_type}</p>
                  </button>
                ))}
              </motion.div>
            )}
            
            {showSearchResults && !selectedCase && searchTerm && filteredCases.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute z-[100] w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4"
              >
                <p className="text-center text-gray-500">No cases found</p>
              </motion.div>
            )}
          </div>
          
          {selectedCase && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary-900">{selectedCase.case_number}</p>
                  <p className="text-sm text-primary-700">{selectedCase.customer_name}</p>
                  <p className="text-sm text-primary-600">{selectedCase.loan_type}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedCase(null);
                    setCalculation(null);
                    setMonthlyIncome('');
                    setRequestedAmount('');
                    setSearchTerm('');
                    setShowSearchResults(false);
                  }}
                >
                  Clear
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Calculation Form */}
        {selectedCase && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Calculate Eligibility</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Input
                label="Monthly Income (₹)"
                type="number"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="Enter monthly income"
                required
              />
              <Input
                label="Requested Amount (₹)"
                type="number"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                placeholder="Enter requested loan amount"
                required
              />
            </div>
            <Button onClick={handleCalculate} disabled={calculating} className="w-full md:w-auto">
              <Calculator className="w-4 h-4 mr-2" />
              {calculating ? 'Calculating...' : 'Calculate Eligibility'}
            </Button>
          </motion.div>
        )}

        {/* Results */}
        {calculation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-white rounded-lg border-2 p-6 ${
              calculation.result === 'ELIGIBLE'
                ? 'border-green-500 bg-green-50'
                : 'border-red-500 bg-red-50'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {calculation.result === 'ELIGIBLE' ? (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {calculation.result === 'ELIGIBLE' ? 'Eligible' : 'Not Eligible'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Calculated on {new Date(calculation.calculated_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {hasPermission('finance.export') && (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleExport('csv')}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    CSV
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleExport('xlsx')}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Excel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleExport('pdf')}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Monthly Income</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{calculation.monthly_income.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Eligible Amount</p>
                <p className="text-2xl font-bold text-primary-600">
                  ₹{calculation.eligible_amount.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Requested Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{calculation.requested_amount.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {calculation.rule_snapshot && (
              <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Eligibility Rule Applied</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Loan Type</p>
                    <p className="font-medium">{calculation.rule_snapshot.loan_type}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Income Multiplier</p>
                    <p className="font-medium">{calculation.rule_snapshot.income_multiplier}x</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Max FOIR</p>
                    <p className="font-medium">{(calculation.rule_snapshot.max_foir * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Age Range</p>
                    <p className="font-medium">
                      {calculation.rule_snapshot.min_age} - {calculation.rule_snapshot.max_age} years
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

    </div>
  );
}

