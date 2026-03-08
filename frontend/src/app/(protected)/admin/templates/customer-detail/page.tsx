'use client';

import { useState, useEffect } from 'react';
import { FileSpreadsheet, Save, Check, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import { crmService } from '@/lib/crm';
import { getErrorMessage } from '@/utils/errorHandler';

interface TemplateField {
  field_key: string;
  field_label: string;
  is_visible: boolean;
  display_order: number;
}

// Default fields based on the Excel template
const DEFAULT_FIELDS: TemplateField[] = [
  { field_key: 'reference_date', field_label: 'Reference / Date', is_visible: true, display_order: 1 },
  { field_key: 'cro_name', field_label: 'CRO Name', is_visible: true, display_order: 2 },
  { field_key: 'location', field_label: 'Location', is_visible: true, display_order: 3 },
  { field_key: 'scheme', field_label: 'Scheme', is_visible: true, display_order: 4 },
  { field_key: 'name', field_label: 'Name', is_visible: true, display_order: 5 },
  { field_key: 'date_of_birth', field_label: 'Date of Birth / Age', is_visible: true, display_order: 6 },
  { field_key: 'aadhar_number', field_label: 'Aadhar Number', is_visible: true, display_order: 7 },
  { field_key: 'pan_number', field_label: 'PAN Card Number', is_visible: true, display_order: 8 },
  { field_key: 'father_name', field_label: 'Father Name', is_visible: true, display_order: 9 },
  { field_key: 'mother_name', field_label: 'Mother Name', is_visible: true, display_order: 10 },
  { field_key: 'marital_status', field_label: 'Marital Status', is_visible: true, display_order: 11 },
  { field_key: 'current_address', field_label: 'Current Address', is_visible: true, display_order: 12 },
  { field_key: 'current_landmark', field_label: 'Current Landmark', is_visible: true, display_order: 13 },
  { field_key: 'current_residence_type', field_label: 'Own house / Rented', is_visible: true, display_order: 14 },
  { field_key: 'permanent_address', field_label: 'Permanent Address', is_visible: true, display_order: 15 },
  { field_key: 'permanent_landmark', field_label: 'Permanent Landmark', is_visible: true, display_order: 16 },
  { field_key: 'mobile_number', field_label: 'Mobile No', is_visible: true, display_order: 17 },
  { field_key: 'personal_email', field_label: 'Personal Mail ID', is_visible: true, display_order: 18 },
  { field_key: 'official_email', field_label: 'Official Mail ID', is_visible: true, display_order: 19 },
  { field_key: 'office_name', field_label: 'Office Name', is_visible: true, display_order: 20 },
  { field_key: 'office_address', field_label: 'Office Address', is_visible: true, display_order: 21 },
  { field_key: 'office_landmark', field_label: 'Office Landmark', is_visible: true, display_order: 22 },
  { field_key: 'designation', field_label: 'Designation', is_visible: true, display_order: 23 },
  { field_key: 'gross_pay', field_label: 'Gross Pay', is_visible: true, display_order: 24 },
  { field_key: 'net_pay', field_label: 'Net Pay', is_visible: true, display_order: 25 },
  { field_key: 'education_qualification', field_label: 'Education Qualification', is_visible: true, display_order: 26 },
  { field_key: 'bank_name', field_label: 'Salary account Bank Name', is_visible: true, display_order: 27 },
  { field_key: 'bank_ifsc', field_label: 'Bank IFSC Code', is_visible: true, display_order: 28 },
  { field_key: 'bank_account_number', field_label: 'Bank Account Number', is_visible: true, display_order: 29 },
  { field_key: 'uan_number', field_label: 'UAN Number (PF NO)', is_visible: true, display_order: 30 },
];

export default function CustomerDetailTemplatePage() {
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const template = await crmService.getCustomerDetailTemplate();
      
      if (template.length === 0) {
        // Initialize with default fields if template is empty
        setFields(DEFAULT_FIELDS);
      } else {
        setFields(template);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
      alert(`Failed to load template: ${getErrorMessage(error)}`);
      // Fallback to default fields
      setFields(DEFAULT_FIELDS);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = (fieldKey: string) => {
    setFields(fields.map(field => 
      field.field_key === fieldKey 
        ? { ...field, is_visible: !field.is_visible }
        : field
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await crmService.updateCustomerDetailTemplate(fields);
      setHasChanges(false);
      alert('Template updated successfully');
    } catch (error) {
      console.error('Failed to save template:', error);
      alert(`Failed to save template: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset to default fields? This will lose any customizations.')) {
      setFields(DEFAULT_FIELDS);
      setHasChanges(true);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Customer Detail Sheet Template"
          description="Configure which fields to display in customer detail popups"
        />
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Customer Detail Sheet Template"
        description="Configure which fields to display in customer detail popups"
        action={
          <div className="flex gap-2">
            {hasChanges && (
              <Button variant="secondary" onClick={handleReset}>
                Reset to Default
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Check the fields you want to display in the customer detail popup. Unchecked fields will be hidden.
          </p>
        </div>

        <div className="space-y-2">
          {fields
            .sort((a, b) => a.display_order - b.display_order)
            .map((field) => (
              <div
                key={field.field_key}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleVisibility(field.field_key)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      field.is_visible
                        ? 'bg-primary-600 border-primary-600'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {field.is_visible && <Check className="w-4 h-4 text-white" />}
                  </button>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{field.field_label}</p>
                    <p className="text-xs text-gray-500">{field.field_key}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  field.is_visible
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {field.is_visible ? 'Visible' : 'Hidden'}
                </span>
              </div>
            ))}
        </div>

        {fields.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No fields configured</p>
            <Button onClick={handleReset} className="mt-4">
              Initialize with Default Fields
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

