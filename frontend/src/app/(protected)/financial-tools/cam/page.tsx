'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Plus, Trash2, Download, Search, Save, History, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import FinancialToolsNav from '@/components/FinancialToolsNav';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { financeService, downloadBlob, CAMEntry, CAMTemplate, CAMField } from '@/lib/finance';
import { crmService, Case } from '@/lib/crm';

export default function CAMPage() {
  const { hasPermission } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [template, setTemplate] = useState<CAMTemplate | null>(null);
  const [entry, setEntry] = useState<CAMEntry | null>(null);
  const [camData, setCamData] = useState<Record<string, any>>({});
  const [userAddedFields, setUserAddedFields] = useState<Record<string, { label: string; type: string }>>({});
  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>();
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const loadTemplate = useCallback(async (loanType: string) => {
    try {
      setLoadingTemplate(true);
      const templateData = await financeService.getCAMTemplate(loanType);
      setTemplate(templateData);
      
      // Initialize camData with default values
      const initialData: Record<string, any> = {};
      if (templateData.fields) {
        templateData.fields.forEach(field => {
          if (field.default_value !== undefined && field.default_value !== null) {
            initialData[field.field_key] = field.field_type === 'number' || field.field_type === 'currency'
              ? parseFloat(field.default_value) || 0
              : field.default_value;
          } else {
            initialData[field.field_key] = '';
          }
        });
      }
      setCamData(initialData);
      setValidationErrors({});
    } catch (error: any) {
      console.error('Failed to load template:', error);
      if (error.response?.status === 404) {
        alert('No CAM template found for this loan type. Please contact an administrator.');
      }
    } finally {
      setLoadingTemplate(false);
    }
  }, []);

  const loadCAMEntry = useCallback(async () => {
    if (!selectedCase) return;
    try {
      const result = await financeService.getCAMEntry(selectedCase.id, selectedVersion);
      setEntry(result);
      setCamData(result.cam_data || {});
      setUserAddedFields(result.user_added_fields || {});
      
      // If template snapshot exists, use it; otherwise load template
      if (result.template_snapshot) {
        // Use snapshot to reconstruct template structure
        const snapshot = result.template_snapshot;
        setTemplate({
          id: snapshot.template_id,
          loan_type: snapshot.loan_type,
          template_name: snapshot.template_name,
          sections: snapshot.sections,
          is_active: true,
          fields: snapshot.fields || [],
        });
      } else if (selectedCase.loan_type) {
        await loadTemplate(selectedCase.loan_type);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No entry exists yet, load template for new entry
        setEntry(null);
        if (selectedCase.loan_type) {
          await loadTemplate(selectedCase.loan_type);
        }
      } else {
        console.error('Failed to load CAM entry:', error);
      }
    }
  }, [selectedCase, selectedVersion, loadTemplate]);

  useEffect(() => {
    if (selectedCase) {
      loadCAMEntry();
    }
  }, [selectedCase, selectedVersion, loadCAMEntry]);

  const handleFieldChange = (fieldKey: string, value: any) => {
    setCamData(prev => ({ ...prev, [fieldKey]: value }));
    // Clear validation error for this field
    if (validationErrors[fieldKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  const handleAddCustomField = () => {
    const fieldKey = `custom_${Date.now()}`;
    const newField = {
      label: `Custom Field ${Object.keys(userAddedFields).length + 1}`,
      type: 'text',
    };
    setUserAddedFields(prev => ({ ...prev, [fieldKey]: newField }));
    setCamData(prev => ({ ...prev, [fieldKey]: '' }));
  };

  const handleRemoveCustomField = (fieldKey: string) => {
    setUserAddedFields(prev => {
      const newFields = { ...prev };
      delete newFields[fieldKey];
      return newFields;
    });
    setCamData(prev => {
      const newData = { ...prev };
      delete newData[fieldKey];
      return newData;
    });
  };

  const validateFields = (): boolean => {
    if (!template) return false;
    
    const errors: Record<string, string> = {};
    
    // Validate mandatory fields
    if (template.fields) {
      template.fields.forEach(field => {
        if (field.is_mandatory) {
          const value = camData[field.field_key];
          if (value === undefined || value === null || value === '') {
            errors[field.field_key] = `${field.label} is required`;
          } else {
            // Type validation
            if (field.field_type === 'number' || field.field_type === 'currency') {
              if (isNaN(parseFloat(String(value)))) {
                errors[field.field_key] = `${field.label} must be a valid number`;
              }
            } else if (field.field_type === 'date') {
              const date = new Date(value);
              if (isNaN(date.getTime())) {
                errors[field.field_key] = `${field.label} must be a valid date`;
              }
            } else if (field.field_type === 'select' && field.select_options) {
              if (!field.select_options.includes(String(value))) {
                errors[field.field_key] = `${field.label} must be one of: ${field.select_options.join(', ')}`;
              }
            }
          }
        }
      });
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!selectedCase || !template) {
      alert('Please select a case');
      return;
    }

    if (!validateFields()) {
      alert('Please fix validation errors before saving');
      return;
    }

    try {
      setSaving(true);
      await financeService.createCAMEntry({
        case_id: selectedCase.id,
        template_id: template.id,
        loan_type: selectedCase.loan_type,
        cam_data: camData,
        user_added_fields: Object.keys(userAddedFields).length > 0 ? userAddedFields : undefined,
      });
      await loadCAMEntry();
      setSelectedVersion(undefined); // Reset to latest version
      alert('CAM entry saved successfully');
    } catch (error: any) {
      console.error('Failed to save CAM entry:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save CAM entry';
      if (errorMessage.includes('Validation failed')) {
        // Parse validation errors from backend
        const backendErrors = errorMessage.split('; ');
        const errors: Record<string, string> = {};
        backendErrors.forEach((err: string) => {
          const match = err.match(/^(.+?): (.+)$/);
          if (match) {
            errors[match[1]] = match[2];
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
      const blob = await financeService.exportCAM(selectedCase.id, format);
      const extension = format === 'xlsx' ? 'xlsx' : format;
      downloadBlob(blob, `cam-${selectedCase.case_number}.${extension}`);
    } catch (error: any) {
      console.error('Failed to export:', error);
      alert(error.response?.data?.error || 'Failed to export');
    }
  };

  const handleVersionSelect = (version: number) => {
    setSelectedVersion(version);
    setShowVersionModal(false);
  };

  const filteredCases = cases.filter(c =>
    c.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Top 3 cases for initial display
  const topCases = cases.slice(0, 3);
  
  // Cases to display: if searching, show filtered results; if no search and no selection, show top 3
  const displayCases = searchTerm ? filteredCases : (selectedCase ? [] : topCases);

  // Group fields by section
  const fieldsBySection = template && template.fields && template.sections
    ? template.sections.map(section => ({
        section,
        fields: template.fields!
          .filter(f => f.section_name === section)
          .sort((a, b) => a.order_index - b.order_index),
      }))
    : [];

  const renderField = (field: CAMField, isUserAdded = false) => {
    const value = camData[field.field_key] ?? '';
    const error = validationErrors[field.field_key];
    const isReadOnly = selectedVersion !== undefined;

    return (
      <div key={field.field_key} className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {field.label}
          {field.is_mandatory && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.field_type === 'select' && field.select_options ? (
          <Select
            value={String(value)}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            disabled={isReadOnly}
            options={field.select_options.map(opt => ({ value: opt, label: opt }))}
            className={error ? 'border-red-500' : ''}
          />
        ) : field.field_type === 'date' ? (
          <Input
            type="date"
            value={value ? (typeof value === 'string' ? value : new Date(value).toISOString().split('T')[0]) : ''}
            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
            disabled={isReadOnly}
            className={error ? 'border-red-500' : ''}
          />
        ) : (
          <Input
            type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : 'text'}
            value={value}
            onChange={(e) => {
              const newValue = field.field_type === 'number' || field.field_type === 'currency'
                ? parseFloat(e.target.value) || 0
                : e.target.value;
              handleFieldChange(field.field_key, newValue);
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
        {isUserAdded && !isReadOnly && (
          <Button
            variant="secondary"
            onClick={() => handleRemoveCustomField(field.field_key)}
            className="mt-1"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Remove
          </Button>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="CAM / Working Sheet"
        description="Create and manage CAM (Credit Assessment Memo) entries with versioning"
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
                  {entry && (
                    <p className="text-xs text-primary-600">Version {entry.version}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {entry && entry.versions && entry.versions.length > 1 && (
                    <Button
                      variant="secondary"
                      onClick={() => setShowVersionModal(true)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      Versions
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedCase(null);
                      setEntry(null);
                      setTemplate(null);
                      setCamData({});
                      setUserAddedFields({});
                      setValidationErrors({});
                      setSelectedVersion(undefined);
                      setSearchTerm('');
                      setShowSearchResults(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
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

        {/* CAM Form */}
        {selectedCase && template && !loadingTemplate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">CAM Data - {template.template_name}</h2>
                {entry && (
                  <p className="text-sm text-gray-600 mt-1">
                    Version {entry.version} • Created {new Date(entry.created_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {hasPermission('finance.export') && entry && (
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
                {template.fields && template.fields.some(f => f.is_user_addable) && selectedVersion === undefined && (
                  <Button
                    variant="secondary"
                    onClick={handleAddCustomField}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field
                  </Button>
                )}
              </div>
            </div>

            {selectedVersion !== undefined && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  You are viewing version {selectedVersion}. This is read-only. To create a new version, clear the selection.
                </p>
              </div>
            )}

            {/* Render fields by section */}
            <div className="space-y-6">
              {fieldsBySection.map(({ section, fields: sectionFields }) => (
                <div key={section} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-md font-semibold text-gray-900 mb-4 sticky top-0 bg-white py-2 border-b border-gray-200">
                    {section}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {sectionFields.map(field => renderField(field))}
                  </div>
                </div>
              ))}

              {/* User-added fields */}
              {Object.keys(userAddedFields).length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-md font-semibold text-gray-900 mb-4">Custom Fields</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {Object.entries(userAddedFields).map(([fieldKey, fieldMeta]) => {
                      const field: CAMField = {
                        id: fieldKey,
                        template_id: template.id,
                        section_name: 'Custom',
                        field_key: fieldKey,
                        label: fieldMeta.label,
                        field_type: fieldMeta.type as any,
                        is_mandatory: false,
                        is_user_addable: true,
                        order_index: 0,
                      };
                      return renderField(field, true);
                    })}
                  </div>
                </div>
              )}
            </div>

            {hasPermission('finance.cam.create') && selectedVersion === undefined && (
              <div className="mt-6 flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save CAM Entry'}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* No Template Message */}
        {selectedCase && !template && !loadingTemplate && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-600">
              No CAM template found for loan type: {selectedCase.loan_type}. Please contact an administrator.
            </p>
          </div>
        )}
      </div>

      {/* Version History Modal */}
      <Modal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        title="Version History"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {entry && entry.versions ? (
            entry.versions.map((version) => (
              <button
                key={version.id}
                onClick={() => handleVersionSelect(version.version)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedVersion === version.version
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Version {version.version}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(version.created_at).toLocaleString()}
                    </p>
                  </div>
                  {selectedVersion === version.version && (
                    <span className="text-primary-600 font-medium">Current</span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <p className="text-center text-gray-600 py-8">No versions available</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
