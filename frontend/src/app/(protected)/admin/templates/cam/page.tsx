'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Edit, Trash2, Save, X, AlertCircle, Eye, Copy,
  GripVertical, ArrowUp, ArrowDown, Search, Check, ChevronDown, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { templateService } from '@/lib/templates';
import { CAMTemplate, CAMField } from '@/lib/finance';
import { getErrorMessage } from '@/utils/errorHandler';
import { toast } from 'sonner';

// Dnd Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
    validation_rules?: {
      min?: number;
      max?: number;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
    };
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

function toFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ===== Sortable Section Header =====
function SortableSection({
  section,
  index,
  fieldCount,
  onRemove,
  onMove,
}: {
  section: string;
  index: number;
  fieldCount: number;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `section-${section}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
      <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="font-medium text-gray-900 flex-1">{section}</span>
      <span className="text-xs text-gray-500">{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
      <div className="flex gap-1">
        <button type="button" onClick={() => onMove('up')} disabled={index === 0} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
          <ArrowUp className="w-3 h-3" />
        </button>
        <button type="button" onClick={() => onMove('down')} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
          <ArrowDown className="w-3 h-3" />
        </button>
      </div>
      <button type="button" onClick={onRemove} className="p-1 hover:bg-red-100 text-red-500 rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ===== Sortable Field Card =====
function SortableFieldCard({
  field,
  index,
  globalIndex,
  sections,
  onChange,
  onRemove,
}: {
  field: TemplateFormData['fields'][0];
  index: number;
  globalIndex: number;
  sections: string[];
  onChange: (idx: number, key: string, val: any) => void;
  onRemove: (idx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `field-${globalIndex}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [showValidation, setShowValidation] = useState(false);
  const [localLabel, setLocalLabel] = useState(field.label);

  const handleLabelBlur = () => {
    onChange(globalIndex, 'label', localLabel);
    if (!field.field_key || field.field_key.startsWith('field_')) {
      const generated = toFieldKey(localLabel);
      if (generated) onChange(globalIndex, 'field_key', generated);
    }
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLabelBlur();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700">
            Field #{index + 1} {field.is_mandatory && <span className="text-red-500">*</span>}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowValidation(!showValidation)}
            className={`text-xs px-2 py-1 rounded ${showValidation ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Validation
          </button>
          <button type="button" onClick={() => onRemove(globalIndex)} className="p-1 hover:bg-red-100 text-red-500 rounded">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Section"
          value={field.section_name}
          onChange={(e) => onChange(globalIndex, 'section_name', e.target.value)}
          required
          options={sections.map(s => ({ value: s, label: s }))}
        />
        <Input
          label="Field Key"
          value={field.field_key}
          onChange={(e) => onChange(globalIndex, 'field_key', e.target.value)}
          required
          placeholder="e.g., customer_name"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Label"
          value={localLabel}
          onChange={(e) => setLocalLabel(e.target.value)}
          onBlur={handleLabelBlur}
          onKeyDown={handleLabelKeyDown}
          required
          placeholder="e.g., Customer Name"
        />
        <Select
          label="Field Type"
          value={field.field_type}
          onChange={(e) => onChange(globalIndex, 'field_type', e.target.value)}
          required
          options={FIELD_TYPES}
        />
      </div>

      {field.field_type === 'select' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Options (comma-separated)</label>
          <Input
            value={field.select_options?.join(', ') || ''}
            onChange={(e) => {
              const options = e.target.value.split(',').map(o => o.trim()).filter(o => o);
              onChange(globalIndex, 'select_options', options);
            }}
            placeholder="Option 1, Option 2, Option 3"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Default Value"
          value={field.default_value || ''}
          onChange={(e) => onChange(globalIndex, 'default_value', e.target.value)}
          placeholder="Optional"
        />
        <div className="space-y-2 pt-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.is_mandatory}
              onChange={(e) => onChange(globalIndex, 'is_mandatory', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Mandatory <span className="text-red-500">*</span></span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.is_user_addable}
              onChange={(e) => onChange(globalIndex, 'is_user_addable', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">User Addable</span>
          </label>
        </div>
      </div>

      {/* Validation Rules Panel */}
      <AnimatePresence>
        {showValidation && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 rounded-lg p-3 space-y-3 border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Validation Rules</p>
              {(field.field_type === 'number' || field.field_type === 'currency') && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Min Value"
                    type="number"
                    value={field.validation_rules?.min ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                      onChange(globalIndex, 'validation_rules', { ...field.validation_rules, min: val });
                    }}
                  />
                  <Input
                    label="Max Value"
                    type="number"
                    value={field.validation_rules?.max ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                      onChange(globalIndex, 'validation_rules', { ...field.validation_rules, max: val });
                    }}
                  />
                </div>
              )}
              {field.field_type === 'text' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Min Length"
                      type="number"
                      value={field.validation_rules?.minLength ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                        onChange(globalIndex, 'validation_rules', { ...field.validation_rules, minLength: val });
                      }}
                    />
                    <Input
                      label="Max Length"
                      type="number"
                      value={field.validation_rules?.maxLength ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                        onChange(globalIndex, 'validation_rules', { ...field.validation_rules, maxLength: val });
                      }}
                    />
                  </div>
                  <Input
                    label="Regex Pattern"
                    value={field.validation_rules?.pattern ?? ''}
                    onChange={(e) => {
                      const val = e.target.value || undefined;
                      onChange(globalIndex, 'validation_rules', { ...field.validation_rules, pattern: val });
                    }}
                    placeholder="e.g., ^[A-Za-z]+$"
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Preview Modal =====
function PreviewModal({
  isOpen,
  onClose,
  formData,
}: {
  isOpen: boolean;
  onClose: () => void;
  formData: TemplateFormData;
}) {
  const fieldsBySection = formData.sections.map(section => ({
    section,
    fields: formData.fields
      .filter(f => f.section_name === section)
      .sort((a, b) => a.order_index - b.order_index),
  })).filter(s => s.fields.length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Template Preview" size="xl">
      <div className="space-y-6">
        <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
          <p className="font-medium text-primary-900">{formData.template_name}</p>
          <p className="text-sm text-primary-700">{formData.loan_type}</p>
        </div>
        {fieldsBySection.map(({ section, fields }) => (
          <div key={section} className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">{section}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(field => (
                <div key={field.field_key} className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {field.label}
                    {field.is_mandatory && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.field_type === 'select' ? (
                    <Select value="" disabled options={field.select_options?.map(o => ({ value: o, label: o })) || []} />
                  ) : field.field_type === 'date' ? (
                    <Input type="date" disabled />
                  ) : (
                    <Input type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : 'text'} disabled placeholder={field.default_value} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {formData.fields.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No fields to preview</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function CAMTemplatesPage() {
  const [templates, setTemplates] = useState<CAMTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [deleteTarget, setDeleteTarget] = useState<CAMTemplate | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
      toast.error(`Failed to load templates: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateDetails = async (id: string) => {
    const template = await templateService.getCAMTemplate(id);
    return template;
  };

  const handleCreate = () => {
    setFormData({ loan_type: '', template_name: '', sections: [], fields: [] });
    setCurrentSection('');
    setSelectedTemplate(null);
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
      toast.error(`Failed to load template: ${getErrorMessage(error)}`);
    }
  };

  const handleClone = async (template: CAMTemplate) => {
    try {
      const fullTemplate = await fetchTemplateDetails(template.id);
      setSelectedTemplate(null);
      setFormData({
        loan_type: fullTemplate.loan_type,
        template_name: `${fullTemplate.template_name} (Copy)`,
        sections: fullTemplate.sections || [],
        fields: (fullTemplate.fields || []).map((f, i) => ({
          section_name: f.section_name,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_mandatory: f.is_mandatory,
          is_user_addable: f.is_user_addable,
          order_index: i,
          default_value: f.default_value,
          validation_rules: f.validation_rules,
          select_options: f.select_options,
        })),
      });
      setModalOpen(true);
      toast.success('Template duplicated. You can now edit and save it.');
    } catch (error) {
      toast.error(`Failed to duplicate template: ${getErrorMessage(error)}`);
    }
  };

  const handleToggleActive = async (template: CAMTemplate) => {
    try {
      await templateService.updateCAMTemplate(template.id, { is_active: !template.is_active });
      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, is_active: !t.is_active } : t));
      toast.success(`Template ${template.is_active ? 'deactivated' : 'activated'} successfully`);
    } catch (error) {
      toast.error(`Failed to update status: ${getErrorMessage(error)}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await templateService.deleteCAMTemplate(deleteTarget.id);
      setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id));
      toast.success('Template deleted successfully');
    } catch (error) {
      toast.error(`Failed to delete template: ${getErrorMessage(error)}`);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleAddSection = () => {
    if (currentSection && !formData.sections.includes(currentSection)) {
      setFormData({ ...formData, sections: [...formData.sections, currentSection] });
      setCurrentSection('');
    }
  };

  const confirmRemoveSection = (section: string) => {
    const count = formData.fields.filter(f => f.section_name === section).length;
    if (count > 0) {
      setSectionToDelete(section);
    } else {
      setFormData({ ...formData, sections: formData.sections.filter(s => s !== section) });
    }
  };

  const executeRemoveSection = () => {
    if (!sectionToDelete) return;
    setFormData({
      ...formData,
      sections: formData.sections.filter(s => s !== sectionToDelete),
      fields: formData.fields.filter(f => f.section_name !== sectionToDelete),
    });
    setSectionToDelete(null);
    toast.info(`Section "${sectionToDelete}" and its fields removed`);
  };

  const handleAddField = (sectionName?: string) => {
    if (!formData.sections.length) {
      toast.error('Please add at least one section first');
      return;
    }
    const targetSection = sectionName || formData.sections[0];
    const sectionFields = formData.fields.filter(f => f.section_name === targetSection);
    const newField = {
      section_name: targetSection,
      field_key: `field_${formData.fields.length + 1}`,
      label: '',
      field_type: 'text' as const,
      is_mandatory: false,
      is_user_addable: false,
      order_index: sectionFields.length,
      default_value: '',
      select_options: [],
    };
    setFormData({ ...formData, fields: [...formData.fields, newField] });
  };

  const handleRemoveField = (index: number) => {
    const newFields = formData.fields.filter((_, i) => i !== index);
    // Recalculate order_index within each section
    const recalculated = newFields.map(f => ({ ...f }));
    formData.sections.forEach(section => {
      const sectionFields = recalculated.filter(f => f.section_name === section);
      sectionFields.forEach((f, idx) => { f.order_index = idx; });
    });
    setFormData({ ...formData, fields: recalculated });
  };

  const handleFieldChange = (index: number, field: string, value: any) => {
    const newFields = [...formData.fields];
    newFields[index] = { ...newFields[index], [field]: value };
    setFormData({ ...formData, fields: newFields });
  };

  const handleMoveSection = (sectionIndex: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && sectionIndex === 0) || (direction === 'down' && sectionIndex === formData.sections.length - 1)) return;
    const newSections = [...formData.sections];
    const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
    [newSections[sectionIndex], newSections[targetIndex]] = [newSections[targetIndex], newSections[sectionIndex]];
    setFormData({ ...formData, sections: newSections });
  };

  // DnD: reorder fields within a section
  const handleFieldDragEnd = (section: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sectionFieldIndices = formData.fields
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.section_name === section)
      .map(({ i }) => i);

    const oldLocalIndex = sectionFieldIndices.findIndex(i => `field-${i}` === active.id);
    const newLocalIndex = sectionFieldIndices.findIndex(i => `field-${i}` === over.id);

    if (oldLocalIndex === -1 || newLocalIndex === -1) return;

    const newFields = [...formData.fields];
    const oldGlobalIndex = sectionFieldIndices[oldLocalIndex];
    const newGlobalIndex = sectionFieldIndices[newLocalIndex];

    // Swap in the full array
    const [moved] = newFields.splice(oldGlobalIndex, 1);
    newFields.splice(newGlobalIndex, 0, moved);

    // Recalculate order_index per section
    formData.sections.forEach(sec => {
      const secFields = newFields.filter(f => f.section_name === sec);
      secFields.forEach((f, idx) => { f.order_index = idx; });
    });

    setFormData({ ...formData, fields: newFields });
  };

  // DnD: reorder sections
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = formData.sections.findIndex(s => `section-${s}` === active.id);
    const newIndex = formData.sections.findIndex(s => `section-${s}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setFormData({ ...formData, sections: arrayMove(formData.sections, oldIndex, newIndex) });
  };

  const validateForm = (): boolean => {
    if (!formData.loan_type || !formData.template_name) {
      toast.error('Please fill in loan type and template name');
      return false;
    }
    if (formData.sections.length === 0) {
      toast.error('Please add at least one section');
      return false;
    }
    if (formData.fields.length === 0) {
      toast.error('Please add at least one field');
      return false;
    }
    const keys = new Set<string>();
    for (const field of formData.fields) {
      if (!field.field_key || !field.label || !field.section_name) {
        toast.error('All fields must have a key, label, and section');
        return false;
      }
      if (keys.has(field.field_key)) {
        toast.error(`Duplicate field key: ${field.field_key}`);
        return false;
      }
      keys.add(field.field_key);
      if (field.field_type === 'select' && (!field.select_options || field.select_options.length === 0)) {
        toast.error(`Select field "${field.label}" must have at least one option`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
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
        toast.success('Template updated successfully');
      } else {
        await templateService.createCAMTemplate(cleanedFormData);
        toast.success('Template created successfully');
      }
      setModalOpen(false);
      setEditModalOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error(`Failed to save template: ${getErrorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditModalOpen(false);
    setSelectedTemplate(null);
    setFormData({ loan_type: '', template_name: '', sections: [], fields: [] });
  };

  const filteredTemplates = templates.filter(t =>
    t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.loan_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <button
          onClick={() => handleToggleActive(template)}
          className={`px-2 py-1 rounded-full text-xs font-medium transition ${
            template.is_active
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {template.is_active ? 'Active' : 'Inactive'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (template: CAMTemplate) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => handleClone(template)} title="Duplicate">
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="secondary" onClick={() => handleEdit(template)} title="Edit">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="danger" onClick={() => setDeleteTarget(template)} title="Delete">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const isModalOpen = modalOpen || editModalOpen;

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

      {/* Search */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search templates by name or loan type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      <Table columns={columns as any} data={filteredTemplates} keyExtractor={(template: any) => template.id} />

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <p className="mt-2 text-gray-600">Loading templates...</p>
        </div>
      )}

      {!loading && filteredTemplates.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            {searchQuery ? 'No templates match your search' : 'No CAM templates yet'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {searchQuery ? 'Try a different search term' : 'Create your first template to get started'}
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedTemplate ? 'Edit CAM Template' : 'Create CAM Template'}
        size="2xl"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Sections</label>
            <div className="flex gap-2 mb-3">
              <Input
                value={currentSection}
                onChange={(e) => setCurrentSection(e.target.value)}
                placeholder="Enter section name"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSection(); } }}
              />
              <Button type="button" variant="secondary" onClick={handleAddSection}>
                Add Section
              </Button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
              <SortableContext items={formData.sections.map(s => `section-${s}`)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {formData.sections.map((section, idx) => (
                    <SortableSection
                      key={section}
                      section={section}
                      index={idx}
                      fieldCount={formData.fields.filter(f => f.section_name === section).length}
                      onRemove={() => confirmRemoveSection(section)}
                      onMove={(dir) => handleMoveSection(idx, dir)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {formData.sections.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                No sections added yet
              </p>
            )}
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Fields ({formData.fields.length})
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
                <Button type="button" variant="secondary" onClick={() => handleAddField()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Field
                </Button>
              </div>
            </div>

            {formData.fields.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 mb-2">No fields added yet</p>
                <p className="text-sm text-gray-400">Add sections first, then add fields to each section</p>
              </div>
            )}

            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {formData.sections.map((section) => {
                const sectionFields = formData.fields
                  .map((f, i) => ({ f, i }))
                  .filter(({ f }) => f.section_name === section)
                  .sort((a, b) => a.f.order_index - b.f.order_index);

                if (sectionFields.length === 0) return null;

                return (
                  <div key={section} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-primary-600">{section}</span>
                      <span className="text-xs font-normal text-gray-500">
                        ({sectionFields.length} {sectionFields.length === 1 ? 'field' : 'fields'})
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        className="ml-auto text-xs py-1 px-2"
                        onClick={() => handleAddField(section)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </h4>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleFieldDragEnd(section, e)}
                    >
                      <SortableContext
                        items={sectionFields.map(({ i }) => `field-${i}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {sectionFields.map(({ f, i }, localIdx) => (
                            <SortableFieldCard
                              key={`field-${i}`}
                              field={f}
                              index={localIdx}
                              globalIndex={i}
                              sections={formData.sections}
                              onChange={handleFieldChange}
                              onRemove={handleRemoveField}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              <Save className="w-4 h-4 mr-2" />
              {selectedTemplate ? 'Update' : 'Create'} Template
            </Button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal */}
      <PreviewModal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} formData={formData} />

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Template" size="md">
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{deleteTarget?.template_name}</strong>?
          </p>
          <p className="text-sm text-gray-500">This action cannot be undone. All associated fields will also be deleted.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Section Delete Confirmation */}
      <Modal isOpen={!!sectionToDelete} onClose={() => setSectionToDelete(null)} title="Remove Section" size="md">
        <div className="space-y-4">
          <p className="text-gray-700">
            Removing <strong>&quot;{sectionToDelete}&quot;</strong> will also delete{' '}
            {formData.fields.filter(f => f.section_name === sectionToDelete).length} associated field(s).
          </p>
          <p className="text-sm text-gray-500">This action cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setSectionToDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={executeRemoveSection}>
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Section
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
