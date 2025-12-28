'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Plus, Trash2, Download, Search, Save, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import FinancialToolsNav from '@/components/FinancialToolsNav';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { useAuth } from '@/contexts/AuthContext';
import { financeService, downloadBlob, ObligationSheet, ObligationTemplate, ObligationField } from '@/lib/finance';
import { crmService, Case } from '@/lib/crm';

export default function ObligationPage() {
  const { hasPermission } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [template, setTemplate] = useState<ObligationTemplate | null>(null);
  const [sheet, setSheet] = useState<ObligationSheet | null>(null);
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [netIncome, setNetIncome] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const searchRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<boolean>(false);
  const templateLoadingRef = useRef<boolean>(false);

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

  const loadTemplate = useCallback(async () => {
    try {
      setLoadingTemplate(true);
      const templateData = await financeService.getObligationTemplate();
      setTemplate(templateData);
      setValidationErrors({});
    } catch (error: any) {
      console.error('Failed to load template:', error);
      if (error.response?.status === 404) {
        alert('No active obligation template found. Please contact an administrator.');
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
      
      // Convert items from template-driven format
      if (result.items && result.items.length > 0) {
        setItems(result.items.map(item => item.item_data || {}));
      } else {
        // Initialize with empty item if template exists
        // Get current template state
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
      
      // If template snapshot exists, use it; otherwise load active template
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
        // No sheet exists yet - just set sheet to null
        // Template loading and item initialization will be handled by separate effect
        setSheet(null);
        setItems([]);
        setNetIncome('');
        // Load template only if not already loading to prevent loops
        if (!templateLoadingRef.current && !template) {
          templateLoadingRef.current = true;
          loadTemplate().finally(() => {
            templateLoadingRef.current = false;
          });
        }
      } else {
        console.error('Failed to load obligation sheet:', error);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [selectedCase, loadTemplate]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (selectedCase) {
      loadObligationSheet();
    } else {
      // Reset state when no case is selected
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
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    // Clear validation errors for this item
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
  };

  const handleItemFieldChange = (itemIndex: number, fieldKey: string, value: any) => {
    const newItems = [...items];
    newItems[itemIndex] = { ...newItems[itemIndex], [fieldKey]: value };
    setItems(newItems);
    
    // Clear validation error for this field
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
            // Type validation
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
      alert('Please select a case, ensure template is loaded, and enter net income');
      return;
    }

    if (!validateFields()) {
      alert('Please fix validation errors before saving');
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
      await loadObligationSheet();
      alert('Obligation sheet saved successfully');
    } catch (error: any) {
      console.error('Failed to save obligation sheet:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save obligation sheet';
      if (errorMessage.includes('Validation failed')) {
        // Parse validation errors from backend
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
      alert(errorMessage);
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
    } catch (error: any) {
      console.error('Failed to export:', error);
      alert(error.response?.data?.error || 'Failed to export');
    }
  };

  // Calculate total obligation (find currency/number fields that represent amounts)
  const calculateTotalObligation = (): number => {
    if (!template || !template.fields) return 0;
    
    // Find fields that likely represent amounts (emi, amount, etc.)
    const amountFields = template.fields.filter(f => 
      f.field_type === 'currency' || 
      f.field_key.toLowerCase().includes('emi') ||
      f.field_key.toLowerCase().includes('amount')
    );
    
    if (amountFields.length === 0) {
      // Fallback: sum all numeric fields
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
  const filteredCases = cases.filter(c =>
    c.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Top 3 cases for initial display
  const topCases = cases.slice(0, 3);
  
  // Cases to display: if searching, show filtered results; if no search and no selection, show top 3
  const displayCases = searchTerm ? filteredCases : (selectedCase ? [] : topCases);

  const renderField = (field: ObligationField, itemIndex: number, value: any) => {
    const error = validationErrors[itemIndex]?.[field.field_key];
    const isReadOnly = false; // Obligation sheets are always editable

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
            disabled={isReadOnly}
            options={field.select_options.map(opt => ({ value: opt, label: opt }))}
            className={error ? 'border-red-500' : ''}
          />
        ) : field.field_type === 'date' ? (
          <Input
            type="date"
            value={value ? (typeof value === 'string' ? value : new Date(value).toISOString().split('T')[0]) : ''}
            onChange={(e) => handleItemFieldChange(itemIndex, field.field_key, e.target.value)}
            disabled={isReadOnly}
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
            disabled={isReadOnly}
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
                  }}
                >
                  Clear
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Loading Template */}
        {selectedCase && loadingTemplate && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
                  </>
                )}
                <Button
                  variant="secondary"
                  onClick={handleAddItem}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </div>

            {/* Obligation Items */}
            <div className="space-y-6 mb-6">
              {items.map((item, itemIndex) => (
                <motion.div
                  key={itemIndex}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-md font-semibold text-gray-900">Item {itemIndex + 1}</h3>
                    <Button
                      variant="secondary"
                      onClick={() => handleRemoveItem(itemIndex)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(template.fields || [])
                      .sort((a, b) => a.order_index - b.order_index)
                      .map(field => renderField(field, itemIndex, item[field.field_key]))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Total Obligation</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{totalObligation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
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
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Available Income</p>
                <p className={`text-2xl font-bold ${
                  (parseFloat(netIncome) || 0) - totalObligation >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  ₹{(
                    (parseFloat(netIncome) || 0) - totalObligation
                  ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
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
            <p className="text-gray-600">
              No active obligation template found. Please contact an administrator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
