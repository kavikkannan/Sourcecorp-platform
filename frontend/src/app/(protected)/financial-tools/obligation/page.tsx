'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet, Plus, Trash2, Download, Search, Save, AlertCircle,
  Clock, X, FileText, ChevronDown, ChevronUp, Layers,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import FinancialToolsNav from '@/components/FinancialToolsNav';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { useAuth } from '@/contexts/AuthContext';
import { financeService, downloadBlob, ObligationSheet, ObligationTemplate, ObligationField } from '@/lib/finance';
import { crmService, Case } from '@/lib/crm';
import { formatIndianNumber } from '@/utils/formatNumber';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import DonutChart from '@/components/DonutChart';

const DRAFT_KEY = 'obligation_draft';

interface ObligationDraft {
  caseId: string;
  caseNumber: string;
  customerName: string;
  items: Array<Record<string, any>>;
  netIncome: string;
  savedAt: string;
}

export default function ObligationPage() {
  const { hasPermission } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [template, setTemplate] = useState<ObligationTemplate | null>(null);
  const [sheet, setSheet] = useState<ObligationSheet | null>(null);
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(new Set());
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [netIncome, setNetIncome] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<boolean>(false);
  const templateLoadingRef = useRef<boolean>(false);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await crmService.getCases({ limit: 100 });
      setCases(response.cases);
      setRecentCases(response.cases.slice(0, 5));
    } catch (error) {
      console.error('Failed to load cases:', error);
      toast.error('Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplate = useCallback(async () => {
    try {
      setLoadingTemplate(true);
      const templateData = await financeService.getObligationTemplate();
      setTemplate(templateData);
      setValidationErrors({});
    } catch (error: any) {
      console.error('Failed to load template:', error);
      if (error.response?.status === 404) {
        toast.error('No active obligation template found. Please contact an administrator.');
      }
    } finally {
      setLoadingTemplate(false);
    }
  }, []);

  const loadObligationSheet = useCallback(async () => {
    if (!selectedCase || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const result = await financeService.getObligationSheet(selectedCase.id);
      setSheet(result);
      if (result.items && result.items.length > 0) {
        setItems(result.items.map(item => item.item_data || {}));
      } else {
        const currentTemplate = template;
        if (currentTemplate && currentTemplate.fields) {
          const emptyItem: Record<string, any> = {};
          currentTemplate.fields.forEach(field => {
            if (field.default_value !== undefined && field.default_value !== null) {
              emptyItem[field.field_key] = field.field_type === 'number' || field.field_type === 'currency'
                ? parseFloat(field.default_value) || 0
                : field.default_value;
            } else {
              emptyItem[field.field_key] = '';
            }
          });
          setItems([emptyItem]);
        }
      }
      setNetIncome(result.net_income.toString());
      if (result.template_snapshot) {
        const snapshot = result.template_snapshot;
        setTemplate({
          id: snapshot.template_id,
          template_name: snapshot.template_name,
          sections: snapshot.sections,
          is_active: true,
          fields: snapshot.fields || [],
        });
      } else {
        await loadTemplate();
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setSheet(null);
        setItems([]);
        setNetIncome('');
        if (!templateLoadingRef.current && !template) {
          templateLoadingRef.current = true;
          loadTemplate().finally(() => {
            templateLoadingRef.current = false;
          });
        }
      } else {
        console.error('Failed to load obligation sheet:', error);
        toast.error('Failed to load obligation sheet');
      }
    } finally {
      loadingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCase, loadTemplate]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (selectedCase) {
      loadObligationSheet();
    } else {
      setSheet(null);
      setItems([]);
      setNetIncome('');
      loadingRef.current = false;
    }
  }, [selectedCase, loadObligationSheet]);

  // Initialize empty item when template loads and no sheet exists
  useEffect(() => {
    if (template && template.fields && !sheet && selectedCase && items.length === 0 && !loadingRef.current) {
      const emptyItem: Record<string, any> = {};
      template.fields.forEach(field => {
        if (field.default_value !== undefined && field.default_value !== null) {
          emptyItem[field.field_key] = field.field_type === 'number' || field.field_type === 'currency'
            ? parseFloat(field.default_value) || 0
            : field.default_value;
        } else {
          emptyItem[field.field_key] = '';
        }
      });
      setItems([emptyItem]);
    }
  }, [template, sheet, selectedCase, items.length]);

  // Auto-save draft
  useEffect(() => {
    if (!selectedCase || items.length === 0) return;
    const draft: ObligationDraft = {
      caseId: selectedCase.id,
      caseNumber: selectedCase.case_number,
      customerName: selectedCase.customer_name,
      items,
      netIncome,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [items, netIncome, selectedCase]);

  // Restore draft
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved && !draftRestored) {
      try {
        const draft: ObligationDraft = JSON.parse(saved);
        const caseExists = cases.find(c => c.id === draft.caseId);
        if (caseExists) {
          setSelectedCase(caseExists);
          setItems(draft.items);
          setNetIncome(draft.netIncome);
          toast.info(`Restored draft for ${draft.caseNumber}`, {
            action: {
              label: 'Discard',
              onClick: () => {
                localStorage.removeItem(DRAFT_KEY);
                setItems([]);
                setNetIncome('');
                setSelectedCase(null);
                toast.success('Draft discarded');
              },
            },
          });
        }
      } catch { /* ignore */ }
      setDraftRestored(true);
    }
  }, [cases, draftRestored]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddItem = () => {
    if (!template || !template.fields) return;
    const emptyItem: Record<string, any> = {};
    template.fields.forEach(field => {
      if (field.default_value !== undefined && field.default_value !== null) {
        emptyItem[field.field_key] = field.field_type === 'number' || field.field_type === 'currency'
          ? parseFloat(field.default_value) || 0
          : field.default_value;
      } else {
        emptyItem[field.field_key] = '';
      }
    });
    setItems([...items, emptyItem]);
    setCollapsedItems(prev => {
      const next = new Set(prev);
      next.delete(items.length); // Ensure new item is expanded
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    setValidationErrors(prev => {
      const newErrors: Record<string, Record<string, string>> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = parseInt(key);
        if (k < index) newErrors[key] = val;
        else if (k > index) newErrors[String(k - 1)] = val;
      });
      return newErrors;
    });
  };

  const toggleItemCollapse = (index: number) => {
    setCollapsedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAllCollapse = () => {
    if (allCollapsed) {
      setCollapsedItems(new Set());
    } else {
      setCollapsedItems(new Set(items.map((_, i) => i)));
    }
    setAllCollapsed(!allCollapsed);
  };

  const handleItemFieldChange = (itemIndex: number, fieldKey: string, value: any) => {
    const newItems = [...items];
    newItems[itemIndex] = { ...newItems[itemIndex], [fieldKey]: value };
    setItems(newItems);
    if (validationErrors[itemIndex]?.[fieldKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[itemIndex]) {
          const itemErrors = { ...newErrors[itemIndex] };
          delete itemErrors[fieldKey];
          newErrors[itemIndex] = itemErrors;
        }
        return newErrors;
      });
    }
  };

  const validateFields = (): boolean => {
    if (!template) return false;
    const errors: Record<string, Record<string, string>> = {};
    items.forEach((item, itemIndex) => {
      const itemErrors: Record<string, string> = {};
      if (template.fields) {
        template.fields.forEach(field => {
          if (field.is_mandatory) {
            const value = item[field.field_key];
            if (value === undefined || value === null || value === '') {
              itemErrors[field.field_key] = `${field.label} is required`;
            } else {
              if (field.field_type === 'number' || field.field_type === 'currency') {
                if (isNaN(parseFloat(String(value)))) {
                  itemErrors[field.field_key] = `${field.label} must be a valid number`;
                }
              } else if (field.field_type === 'date') {
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                  itemErrors[field.field_key] = `${field.label} must be a valid date`;
                }
              } else if (field.field_type === 'select' && field.select_options) {
                if (!field.select_options.includes(String(value))) {
                  itemErrors[field.field_key] = `${field.label} must be one of: ${field.select_options.join(', ')}`;
                }
              }
            }
          }
          // validation rules
          if (field.validation_rules && item[field.field_key]) {
            const val = item[field.field_key];
            const rules = field.validation_rules;
            if (rules.min !== undefined && parseFloat(String(val)) < rules.min) {
              itemErrors[field.field_key] = `${field.label} must be at least ${rules.min}`;
            }
            if (rules.max !== undefined && parseFloat(String(val)) > rules.max) {
              itemErrors[field.field_key] = `${field.label} must be at most ${rules.max}`;
            }
            if (rules.minLength !== undefined && String(val).length < rules.minLength) {
              itemErrors[field.field_key] = `${field.label} must be at least ${rules.minLength} characters`;
            }
            if (rules.maxLength !== undefined && String(val).length > rules.maxLength) {
              itemErrors[field.field_key] = `${field.label} must be at most ${rules.maxLength} characters`;
            }
            if (rules.pattern && !new RegExp(rules.pattern).test(String(val))) {
              itemErrors[field.field_key] = `${field.label} format is invalid`;
            }
          }
        });
      }
      if (Object.keys(itemErrors).length > 0) {
        errors[itemIndex] = itemErrors;
      }
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!selectedCase || !template || !netIncome) {
      toast.error('Please select a case, ensure template is loaded, and enter net income');
      return;
    }
    if (!validateFields()) {
      toast.error('Please fix validation errors before saving');
      return;
    }
    try {
      setSaving(true);
      await financeService.createObligationSheet({
        case_id: selectedCase.id,
        template_id: template.id,
        items: items,
        net_income: parseFloat(netIncome),
      });
      localStorage.removeItem(DRAFT_KEY);
      await loadObligationSheet();
      toast.success('Obligation sheet saved successfully');
    } catch (error: any) {
      console.error('Failed to save obligation sheet:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save obligation sheet';
      if (errorMessage.includes('Validation failed')) {
        const backendErrors = errorMessage.split('; ');
        const errors: Record<string, Record<string, string>> = {};
        backendErrors.forEach((err: string) => {
          const match = err.match(/^Item (\d+): (.+?): (.+)$/);
          if (match) {
            const itemIndex = parseInt(match[1]) - 1;
            if (!errors[itemIndex]) errors[itemIndex] = {};
            errors[itemIndex][match[2]] = match[3];
          }
        });
        setValidationErrors(errors);
      }
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!selectedCase) return;
    try {
      const blob = await financeService.exportObligation(selectedCase.id, format);
      const extension = format === 'xlsx' ? 'xlsx' : format;
      downloadBlob(blob, `obligation-${selectedCase.case_number}.${extension}`);
      toast.success(`Exported as ${extension.toUpperCase()}`);
    } catch (error: any) {
      console.error('Failed to export:', error);
      toast.error(error.response?.data?.error || 'Failed to export');
    }
  };

  const calculateTotalObligation = (): number => {
    if (!template || !template.fields) return 0;
    const amountFields = template.fields.filter(f =>
      f.field_type === 'currency' ||
      f.field_key.toLowerCase().includes('emi') ||
      f.field_key.toLowerCase().includes('amount')
    );
    if (amountFields.length === 0) {
      return items.reduce((sum, item) => {
        return sum + Object.values(item).reduce((itemSum: number, value: any) => {
          if (typeof value === 'number') return itemSum + value;
          if (typeof value === 'string' && !isNaN(parseFloat(value))) return itemSum + parseFloat(value);
          return itemSum;
        }, 0);
      }, 0);
    }
    return items.reduce((sum, item) => {
      return sum + amountFields.reduce((fieldSum, field) => {
        const value = item[field.field_key] || 0;
        return fieldSum + (typeof value === 'number' ? value : parseFloat(String(value)) || 0);
      }, 0);
    }, 0);
  };

  const totalObligation = calculateTotalObligation();
  const netIncomeNum = parseFloat(netIncome) || 0;
  const availableIncome = netIncomeNum - totalObligation;

  const filteredCases = cases.filter(c =>
    c.case_number.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    c.customer_name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const displayCases = debouncedSearch ? filteredCases : [];

  // Group fields by section
  const fieldsBySection = template && template.fields && template.sections
    ? template.sections.map(section => ({
        section,
        fields: template.fields!
          .filter(f => f.section_name === section)
          .sort((a, b) => a.order_index - b.order_index),
      })).filter(s => s.fields.length > 0)
    : [];

  const renderField = (field: ObligationField, itemIndex: number, value: any) => {
    const error = validationErrors[itemIndex]?.[field.field_key];
    return (
      <div key={field.field_key} className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {field.label}
          {field.is_mandatory && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.field_type === 'select' && field.select_options ? (
          <Select
            value={String(value || '')}
            onChange={(e) => handleItemFieldChange(itemIndex, field.field_key, e.target.value)}
            options={field.select_options.map(opt => ({ value: opt, label: opt }))}
            className={error ? 'border-red-500' : ''}
          />
        ) : field.field_type === 'date' ? (
          <Input
            type="date"
            value={value ? (typeof value === 'string' ? value : new Date(value).toISOString().split('T')[0]) : ''}
            onChange={(e) => handleItemFieldChange(itemIndex, field.field_key, e.target.value)}
            className={error ? 'border-red-500' : ''}
          />
        ) : (
          <Input
            type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : 'text'}
            value={value || ''}
            onChange={(e) => {
              const newValue = field.field_type === 'number' || field.field_type === 'currency'
                ? parseFloat(e.target.value) || 0
                : e.target.value;
              handleItemFieldChange(itemIndex, field.field_key, newValue);
            }}
            className={error ? 'border-red-500' : ''}
            placeholder={field.default_value}
          />
        )}
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Obligation Sheet"
        description="Manage monthly obligations and calculate net income"
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

            <AnimatePresence>
              {showSearchResults && !selectedCase && displayCases.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
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
            </AnimatePresence>

            {showSearchResults && !selectedCase && debouncedSearch && filteredCases.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute z-[100] w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4"
              >
                <div className="text-center text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No cases found</p>
                </div>
              </motion.div>
            )}
          </div>

          {!selectedCase && !debouncedSearch && recentCases.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Recent Cases</p>
              <div className="flex flex-wrap gap-2">
                {recentCases.map((caseItem) => (
                  <button
                    key={caseItem.id}
                    onClick={() => setSelectedCase(caseItem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-700 rounded-full text-sm transition"
                  >
                    <Clock className="w-3 h-3" />
                    {caseItem.case_number}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!selectedCase && !debouncedSearch && recentCases.length === 0 && !loading && (
            <div className="mt-4 text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No cases available</p>
              <p className="text-sm text-gray-500 mt-1">Create a case in the CRM to get started</p>
            </div>
          )}

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
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedCase(null);
                    setSheet(null);
                    setTemplate(null);
                    setItems([]);
                    setNetIncome('');
                    setValidationErrors({});
                    setSearchTerm('');
                    setShowSearchResults(false);
                    localStorage.removeItem(DRAFT_KEY);
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Loading Template */}
        {selectedCase && loadingTemplate && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            <p className="mt-2 text-gray-600">Loading template...</p>
          </div>
        )}

        {/* Obligation Sheet */}
        {selectedCase && template && !loadingTemplate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Obligation Items - {template.template_name}</h2>
                {sheet && (
                  <p className="text-sm text-gray-600 mt-1">
                    Last updated {new Date(sheet.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {hasPermission('finance.export') && sheet && (
                  <>
                    <Button variant="secondary" onClick={() => handleExport('csv')}>
                      <Download className="w-4 h-4 mr-1" /> CSV
                    </Button>
                    <Button variant="secondary" onClick={() => handleExport('xlsx')}>
                      <Download className="w-4 h-4 mr-1" /> Excel
                    </Button>
                    <Button variant="secondary" onClick={() => handleExport('pdf')}>
                      <Download className="w-4 h-4 mr-1" /> PDF
                    </Button>
                  </>
                )}
                <Button variant="secondary" onClick={toggleAllCollapse}>
                  {allCollapsed ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronUp className="w-4 h-4 mr-1" />}
                  {allCollapsed ? 'Expand All' : 'Collapse All'}
                </Button>
                <Button variant="secondary" onClick={handleAddItem}>
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>
            </div>

            {/* Obligation Items */}
            <div className="space-y-4 mb-6">
              {items.map((item, itemIndex) => (
                <motion.div
                  key={itemIndex}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleItemCollapse(itemIndex)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      {collapsedItems.has(itemIndex) ? (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                      )}
                      <h3 className="text-md font-semibold text-gray-900">Item {itemIndex + 1}</h3>
                      {validationErrors[itemIndex] && Object.keys(validationErrors[itemIndex]).length > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          {Object.keys(validationErrors[itemIndex]).length} error(s)
                        </span>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); handleRemoveItem(itemIndex); }}
                      disabled={items.length === 1}
                      className="text-xs"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  </button>
                  <AnimatePresence>
                    {!collapsedItems.has(itemIndex) && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4">
                          {fieldsBySection.length > 0 ? (
                            <div className="space-y-4">
                              {fieldsBySection.map(({ section, fields }) => (
                                <div key={section}>
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{section}</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {fields.map(field => renderField(field, itemIndex, item[field.field_key]))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {(template.fields || [])
                                .sort((a, b) => a.order_index - b.order_index)
                                .map(field => renderField(field, itemIndex, item[field.field_key]))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Summary with Chart */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center gap-4">
                <DonutChart
                  segments={[
                    { label: 'Obligation', value: totalObligation, color: '#ef4444' },
                    { label: 'Available', value: Math.max(0, availableIncome), color: '#22c55e' },
                  ]}
                  size={80}
                  strokeWidth={12}
                />
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Obligation</p>
                  <p className="text-xl font-bold text-gray-900">
                    ₹{formatIndianNumber(totalObligation, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <Input
                  label="Net Income (₹)"
                  type="number"
                  value={netIncome}
                  onChange={(e) => setNetIncome(e.target.value)}
                  placeholder="Enter net income"
                />
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col justify-center">
                <p className="text-sm text-gray-600 mb-1">Available Income</p>
                <p className={`text-2xl font-bold ${availableIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{formatIndianNumber(availableIncome, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col justify-center">
                <p className="text-sm text-gray-600 mb-1">Items</p>
                <p className="text-2xl font-bold text-gray-900">{items.length}</p>
              </div>
            </div>

            {hasPermission('finance.obligation.create') && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Obligation Sheet'}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* No Template Message */}
        {selectedCase && !template && !loadingTemplate && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No active obligation template found</p>
            <p className="text-sm text-gray-500 mt-1">Please contact an administrator.</p>
          </div>
        )}
      </div>
    </div>
  );
}
