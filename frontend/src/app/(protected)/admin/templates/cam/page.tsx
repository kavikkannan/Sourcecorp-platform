'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, Save, X, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { templateService } from '@/lib/templates';
import { CAMTemplate, CAMField } from '@/lib/finance';
import { getErrorMessage } from '@/utils/errorHandler';

interface TemplateFormData {
  loan_type: string;
  template_name: string;
  sections: string[];
  fields: Array<{
    section_name: string;
    field_key: string;
    label: string;
    field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
    is_mandatory: boolean;
    is_user_addable: boolean;
    order_index: number;
    default_value?: string;
    validation_rules?: any;
    select_options?: string[];
  }>;
}

const LOAN_TYPES = [
  'Personal Loan',
  'Home Loan',
  'Car Loan',
  'Business Loan',
  'Education Loan',
  'Gold Loan',
  'Other',
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
];

export default function CAMTemplatesPage() {
  const [templates, setTemplates] = useState<CAMTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CAMTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    loan_type: '',
    template_name: '',
    sections: [],
    fields: [],
  });
  const [currentSection, setCurrentSection] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const templates = await templateService.getAllCAMTemplates();
      setTemplates(templates);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      alert(`Failed to load templates: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateDetails = async (id: string) => {
    try {
      const template = await templateService.getCAMTemplate(id);
      return template;
    } catch (error) {
      console.error('Failed to fetch template details:', error);
      throw error;
    }
  };

  const handleCreate = () => {
    setFormData({
      loan_type: '',
      template_name: '',
      sections: [],
      fields: [],
    });
    setCurrentSection('');
    setModalOpen(true);
  };

  const handleEdit = async (template: CAMTemplate) => {
    try {
      const fullTemplate = await fetchTemplateDetails(template.id);
      setSelectedTemplate(fullTemplate);
      setFormData({
        loan_type: fullTemplate.loan_type,
        template_name: fullTemplate.template_name,
        sections: fullTemplate.sections || [],
        fields: (fullTemplate.fields || []).map(f => ({
          section_name: f.section_name,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_mandatory: f.is_mandatory,
          is_user_addable: f.is_user_addable,
          order_index: f.order_index,
          default_value: f.default_value,
          validation_rules: f.validation_rules,
          select_options: f.select_options,
        })),
      });
      setEditModalOpen(true);
    } catch (error) {
      alert(`Failed to load template: ${getErrorMessage(error)}`);
    }
  };

  const handleAddSection = () => {
    if (currentSection && !formData.sections.includes(currentSection)) {
      setFormData({
        ...formData,
        sections: [...formData.sections, currentSection],
      });
      setCurrentSection('');
    }
  };

  const handleRemoveSection = (section: string) => {
    setFormData({
      ...formData,
      sections: formData.sections.filter(s => s !== section),
      fields: formData.fields.filter(f => f.section_name !== section),
    });
  };

  const handleAddField = (sectionName?: string) => {
    if (!formData.sections.length) {
      alert('Please add at least one section first');
      return;
    }
    const newField = {
      section_name: sectionName || formData.sections[0],
      field_key: `field_${formData.fields.length + 1}`,
      label: '',
      field_type: 'text' as const,
      is_mandatory: false,
      is_user_addable: false,
      order_index: formData.fields.length,
      default_value: '',
      select_options: [],
    };
    setFormData({
      ...formData,
      fields: [...formData.fields, newField],
    });
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === formData.fields.length - 1)
    ) {
      return;
    }
    const newFields = [...formData.fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    // Update order_index
    newFields.forEach((field, idx) => {
      field.order_index = idx;
    });
    setFormData({ ...formData, fields: newFields });
  };

  const handleMoveSection = (sectionIndex: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && sectionIndex === 0) ||
      (direction === 'down' && sectionIndex === formData.sections.length - 1)
    ) {
      return;
    }
    const newSections = [...formData.sections];
    const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
    [newSections[sectionIndex], newSections[targetIndex]] = [newSections[targetIndex], newSections[sectionIndex]];
    setFormData({ ...formData, sections: newSections });
  };

  const handleRemoveField = (index: number) => {
    setFormData({
      ...formData,
      fields: formData.fields.filter((_, i) => i !== index),
    });
  };

  const handleFieldChange = (index: number, field: keyof TemplateFormData['fields'][0], value: any) => {
    const newFields = [...formData.fields];
    newFields[index] = { ...newFields[index], [field]: value };
    setFormData({ ...formData, fields: newFields });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.loan_type || !formData.template_name) {
      alert('Please fill in loan type and template name');
      return;
    }

    if (formData.sections.length === 0) {
      alert('Please add at least one section');
      return;
    }

    if (formData.fields.length === 0) {
      alert('Please add at least one field');
      return;
    }

    // Validate all fields have required properties
    for (const field of formData.fields) {
      if (!field.field_key || !field.label || !field.section_name) {
        alert('All fields must have a key, label, and section');
        return;
      }
      if (field.field_type === 'select' && (!field.select_options || field.select_options.length === 0)) {
        alert('Select fields must have at least one option');
        return;
      }
    }

    try {
      setSubmitting(true);
      // Clean up null values - convert to undefined for optional fields
      const cleanedFormData = {
        ...formData,
        fields: formData.fields.map(field => ({
          ...field,
          default_value: field.default_value || undefined,
          validation_rules: field.validation_rules || undefined,
          select_options: field.select_options && field.select_options.length > 0 ? field.select_options : undefined,
        })),
      };
      
      if (selectedTemplate) {
        await templateService.updateCAMTemplate(selectedTemplate.id, cleanedFormData);
      } else {
        await templateService.createCAMTemplate(cleanedFormData);
      }
      setModalOpen(false);
      setEditModalOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert(`Failed to save template: ${getErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'template',
      header: 'Template',
      render: (template: CAMTemplate) => (
        <div>
          <div className="font-medium text-gray-900">{template.template_name}</div>
          <div className="text-sm text-gray-500">{template.loan_type}</div>
        </div>
      ),
    },
    {
      key: 'sections',
      header: 'Sections',
      render: (template: CAMTemplate) => (
        <div className="text-sm text-gray-600">{(template.sections || []).length} sections</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (template: CAMTemplate) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            template.is_active
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {template.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (template: CAMTemplate) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => handleEdit(template)}
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="CAM Templates"
        description="Manage CAM (Credit Assessment Memo) templates for different loan types"
        action={
          <Button icon={<Plus className="w-5 h-5" />} onClick={handleCreate}>
            Create Template
          </Button>
        }
      />

      <Table columns={columns} data={templates} keyExtractor={(template) => template.id} />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen || editModalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditModalOpen(false);
          setSelectedTemplate(null);
          setFormData({
            loan_type: '',
            template_name: '',
            sections: [],
            fields: [],
          });
        }}
        title={selectedTemplate ? 'Edit CAM Template' : 'Create CAM Template'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Loan Type"
              value={formData.loan_type}
              onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
              required
              options={LOAN_TYPES.map(lt => ({ value: lt, label: lt }))}
            />
            <Input
              label="Template Name"
              value={formData.template_name}
              onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
              required
              placeholder="e.g., Standard CAM Template"
            />
          </div>

          {/* Sections */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sections
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                value={currentSection}
                onChange={(e) => setCurrentSection(e.target.value)}
                placeholder="Enter section name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSection();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={handleAddSection}>
                Add Section
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.sections.map((section) => (
                <span
                  key={section}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                >
                  {section}
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(section)}
                    className="hover:text-primary-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Fields - Grouped by Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Fields ({formData.fields.length})
                <span className="text-xs text-gray-500 ml-2">
                  Organized by section
                </span>
              </label>
              <Button type="button" variant="secondary" onClick={() => handleAddField()}>
                <Plus className="w-4 h-4 mr-1" />
                Add Field
              </Button>
            </div>
            {formData.fields.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 mb-2">No fields added yet</p>
                <p className="text-sm text-gray-400">Add sections first, then add fields to each section</p>
              </div>
            )}
            <div className="space-y-6 max-h-96 overflow-y-auto">
              {formData.sections.map((section) => {
                const sectionFields = formData.fields
                  .filter(f => f.section_name === section)
                  .sort((a, b) => a.order_index - b.order_index);
                
                if (sectionFields.length === 0) return null;

                return (
                  <div key={section} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-primary-600">{section}</span>
                      <span className="text-xs font-normal text-gray-500">
                        ({sectionFields.length} {sectionFields.length === 1 ? 'field' : 'fields'})
                      </span>
                    </h4>
                    <div className="space-y-3">
                      {sectionFields.map((field, fieldIndex) => {
                        const globalIndex = formData.fields.findIndex(f => f === field);
                        return (
                          <div key={globalIndex} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">
                                Field #{fieldIndex + 1} {field.is_mandatory && <span className="text-red-500">*</span>}
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="px-2 py-1 text-xs"
                                  onClick={() => handleMoveField(globalIndex, 'up')}
                                  disabled={fieldIndex === 0 || formData.fields[globalIndex - 1]?.section_name !== section}
                                  title="Move up"
                                >
                                  ↑
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="px-2 py-1 text-xs"
                                  onClick={() => handleMoveField(globalIndex, 'down')}
                                  disabled={fieldIndex === sectionFields.length - 1 || formData.fields[globalIndex + 1]?.section_name !== section}
                                  title="Move down"
                                >
                                  ↓
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="px-2 py-1"
                                  onClick={() => handleRemoveField(globalIndex)}
                                  title="Remove field"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <Select
                                label="Section"
                                value={field.section_name}
                                onChange={(e) => handleFieldChange(globalIndex, 'section_name', e.target.value)}
                                required
                                options={formData.sections.map(s => ({ value: s, label: s }))}
                              />
                              <Input
                                label="Field Key"
                                value={field.field_key}
                                onChange={(e) => handleFieldChange(globalIndex, 'field_key', e.target.value)}
                                required
                                placeholder="e.g., customer_name"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                label="Label"
                                value={field.label}
                                onChange={(e) => handleFieldChange(globalIndex, 'label', e.target.value)}
                                required
                                placeholder="e.g., Customer Name"
                              />
                              <Select
                                label="Field Type"
                                value={field.field_type}
                                onChange={(e) => handleFieldChange(globalIndex, 'field_type', e.target.value)}
                                required
                                options={FIELD_TYPES}
                              />
                            </div>
                            {field.field_type === 'select' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Options (comma-separated)
                                </label>
                                <Input
                                  value={field.select_options?.join(', ') || ''}
                                  onChange={(e) => {
                                    const options = e.target.value.split(',').map(o => o.trim()).filter(o => o);
                                    handleFieldChange(globalIndex, 'select_options', options);
                                  }}
                                  placeholder="Option 1, Option 2, Option 3"
                                />
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                              <Input
                                label="Default Value"
                                value={field.default_value || ''}
                                onChange={(e) => handleFieldChange(globalIndex, 'default_value', e.target.value)}
                                placeholder="Optional"
                              />
                              <Input
                                label="Order Index"
                                type="number"
                                value={field.order_index}
                                onChange={(e) => handleFieldChange(globalIndex, 'order_index', parseInt(e.target.value) || 0)}
                                required
                              />
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.is_mandatory}
                                    onChange={(e) => handleFieldChange(globalIndex, 'is_mandatory', e.target.checked)}
                                    className="w-4 h-4 text-primary-600 rounded"
                                  />
                                  <span className="text-sm text-gray-700">
                                    Mandatory <span className="text-red-500">*</span>
                                  </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.is_user_addable}
                                    onChange={(e) => handleFieldChange(globalIndex, 'is_user_addable', e.target.checked)}
                                    className="w-4 h-4 text-primary-600 rounded"
                                  />
                                  <span className="text-sm text-gray-700">User Addable</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setModalOpen(false);
                setEditModalOpen(false);
                setSelectedTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              <Save className="w-4 h-4 mr-2" />
              {selectedTemplate ? 'Update' : 'Create'} Template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

