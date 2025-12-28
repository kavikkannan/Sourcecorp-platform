'use client';

import { useState, useEffect } from 'react';
import { FileSpreadsheet, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { templateService } from '@/lib/templates';
import { ObligationTemplate, ObligationField } from '@/lib/finance';
import { getErrorMessage } from '@/utils/errorHandler';

interface TemplateFormData {
  template_name: string;
  sections: string[];
  fields: Array<{
    field_key: string;
    label: string;
    field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
    is_mandatory: boolean;
    is_repeatable: boolean;
    order_index: number;
    default_value?: string;
    validation_rules?: any;
    select_options?: string[];
  }>;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
];

export default function ObligationTemplatesPage() {
  const [templates, setTemplates] = useState<ObligationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ObligationTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
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
      const templates = await templateService.getAllObligationTemplates();
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
      const template = await templateService.getObligationTemplate(id);
      return template;
    } catch (error) {
      console.error('Failed to fetch template details:', error);
      throw error;
    }
  };

  const handleCreate = () => {
    setFormData({
      template_name: '',
      sections: [],
      fields: [],
    });
    setCurrentSection('');
    setModalOpen(true);
  };

  const handleEdit = async (template: ObligationTemplate) => {
    try {
      const fullTemplate = await fetchTemplateDetails(template.id);
      setSelectedTemplate(fullTemplate);
      setFormData({
        template_name: fullTemplate.template_name,
        sections: fullTemplate.sections || [],
        fields: (fullTemplate.fields || []).map(f => ({
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_mandatory: f.is_mandatory,
          is_repeatable: f.is_repeatable,
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
    });
  };

  const handleAddField = (section?: string) => {
    const newField = {
      field_key: `field_${formData.fields.length + 1}`,
      label: '',
      field_type: 'text' as const,
      is_mandatory: false,
      is_repeatable: true,
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
    
    if (!formData.template_name) {
      alert('Please fill in template name');
      return;
    }

    if (formData.fields.length === 0) {
      alert('Please add at least one field');
      return;
    }

    // Validate all fields have required properties
    for (const field of formData.fields) {
      if (!field.field_key || !field.label) {
        alert('All fields must have a key and label');
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
        template_name: formData.template_name,
        sections: formData.sections || [], // Ensure sections is always an array
        fields: formData.fields.map(field => ({
          ...field,
          default_value: field.default_value || undefined,
          validation_rules: field.validation_rules || undefined,
          select_options: field.select_options && field.select_options.length > 0 ? field.select_options : undefined,
        })),
      };
      
      if (selectedTemplate) {
        await templateService.updateObligationTemplate(selectedTemplate.id, cleanedFormData);
      } else {
        await templateService.createObligationTemplate(cleanedFormData);
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
      render: (template: ObligationTemplate) => (
        <div>
          <div className="font-medium text-gray-900">{template.template_name}</div>
        </div>
      ),
    },
    {
      key: 'sections',
      header: 'Sections',
      render: (template: ObligationTemplate) => (
        <div className="text-sm text-gray-600">{(template.sections || []).length} sections</div>
      ),
    },
    {
      key: 'fields',
      header: 'Fields',
      render: (template: ObligationTemplate) => (
        <div className="text-sm text-gray-600">{(template.fields || []).length} fields</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (template: ObligationTemplate) => (
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
      render: (template: ObligationTemplate) => (
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
        title="Obligation Templates"
        description="Manage obligation sheet templates"
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
            template_name: '',
            sections: [],
            fields: [],
          });
        }}
        title={selectedTemplate ? 'Edit Obligation Template' : 'Create Obligation Template'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Template Name"
            value={formData.template_name}
            onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
            required
            placeholder="e.g., Standard Obligation Template"
          />

          {/* Sections */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sections (Optional)
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

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Fields ({formData.fields.length})
              </label>
              <Button type="button" variant="secondary" onClick={() => handleAddField()}>
                <Plus className="w-4 h-4 mr-1" />
                Add Field
              </Button>
            </div>
            {formData.fields.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 mb-2">No fields added yet</p>
                <p className="text-sm text-gray-400">Click &quot;Add Field&quot; to start building your template</p>
              </div>
            )}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {formData.fields.map((field, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Field #{index + 1} {field.is_mandatory && <span className="text-red-500">*</span>}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onClick={() => handleMoveField(index, 'up')}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onClick={() => handleMoveField(index, 'down')}
                        disabled={index === formData.fields.length - 1}
                        title="Move down"
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1"
                        onClick={() => handleRemoveField(index)}
                        title="Remove field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Field Key"
                      value={field.field_key}
                      onChange={(e) => handleFieldChange(index, 'field_key', e.target.value)}
                      required
                      placeholder="e.g., description"
                    />
                    <Input
                      label="Label"
                      value={field.label}
                      onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                      required
                      placeholder="e.g., Description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Field Type"
                      value={field.field_type}
                      onChange={(e) => handleFieldChange(index, 'field_type', e.target.value)}
                      required
                      options={FIELD_TYPES}
                    />
                    <Input
                      label="Order Index"
                      type="number"
                      value={field.order_index}
                      onChange={(e) => handleFieldChange(index, 'order_index', parseInt(e.target.value) || 0)}
                      required
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
                          handleFieldChange(index, 'select_options', options);
                        }}
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Default Value"
                      value={field.default_value || ''}
                      onChange={(e) => handleFieldChange(index, 'default_value', e.target.value)}
                      placeholder="Optional"
                    />
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field.is_mandatory}
                          onChange={(e) => handleFieldChange(index, 'is_mandatory', e.target.checked)}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Mandatory</span>
                      </label>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.is_repeatable}
                          onChange={(e) => handleFieldChange(index, 'is_repeatable', e.target.checked)}
                          className="w-4 h-4 text-primary-600 rounded"
                          disabled
                          title="Obligation fields are always repeatable"
                        />
                        <span className="text-sm text-gray-700">
                          Repeatable
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
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

