'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Award, Star, ImageIcon } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import api, { API_URL } from '@/lib/api';

interface Recognition {
  id: string;
  type: 'MONTHLY_ACHIEVER' | 'BEST_EMPLOYEE';
  employee_name: string;
  employee_email: string | null;
  designation: string | null;
  month: string;
  description: string | null;
  image_path: string | null;
  is_active: boolean;
  creator_name: string | null;
  created_at: string;
}

export default function RecognitionsPage() {
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'MONTHLY_ACHIEVER' | 'BEST_EMPLOYEE'>('MONTHLY_ACHIEVER');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'MONTHLY_ACHIEVER' as 'MONTHLY_ACHIEVER' | 'BEST_EMPLOYEE',
    employee_name: '',
    employee_email: '',
    designation: '',
    month: new Date().toISOString().slice(0, 7),
    description: '',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRecognitions();
  }, []);

  const fetchRecognitions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/recognitions');
      setRecognitions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch recognitions:', error);
      setRecognitions([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = recognitions.filter((r) => r.type === activeTab);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('type', formData.type);
      formDataToSend.append('employee_name', formData.employee_name);
      if (formData.employee_email) formDataToSend.append('employee_email', formData.employee_email);
      if (formData.designation) formDataToSend.append('designation', formData.designation);
      formDataToSend.append('month', formData.month);
      if (formData.description) formDataToSend.append('description', formData.description);
      if (selectedImage) formDataToSend.append('image', selectedImage);

      await api.post('/admin/recognitions', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setModalOpen(false);
      resetForm();
      fetchRecognitions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create recognition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete recognition for ${name}?`)) return;
    try {
      await api.delete(`/admin/recognitions/${id}`);
      fetchRecognitions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete recognition');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({
      type: activeTab,
      employee_name: '',
      employee_email: '',
      designation: '',
      month: new Date().toISOString().slice(0, 7),
      description: '',
    });
    setSelectedImage(null);
    setImagePreview(null);
  };

  const openCreateModal = (type: 'MONTHLY_ACHIEVER' | 'BEST_EMPLOYEE') => {
    setFormData({
      type,
      employee_name: '',
      employee_email: '',
      designation: '',
      month: new Date().toISOString().slice(0, 7),
      description: '',
    });
    setSelectedImage(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const getImageUrl = (id: string) => `${API_URL.replace('/api', '')}/api/recognitions/${id}/image`;

  const columns: { key: string; header: string; render: (item: Recognition) => React.ReactNode }[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row: Recognition) => (
        <div className="flex items-center gap-3">
          {row.image_path ? (
            <img
              src={getImageUrl(row.id)}
              alt={row.employee_name}
              className="w-10 h-10 rounded-full object-cover border border-gray-200"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-gray-400" />
            </div>
          )}
          <div>
            <div className="font-medium text-gray-900">{row.employee_name}</div>
            {row.employee_email && <div className="text-xs text-gray-500">{row.employee_email}</div>}
          </div>
        </div>
      ),
    },
    { key: 'designation', header: 'Designation', render: (row: Recognition) => row.designation || '-' },
    { key: 'month', header: 'Month', render: (row: Recognition) => row.month },
    {
      key: 'status',
      header: 'Status',
      render: (row: Recognition) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: Recognition) => (
        <button
          onClick={() => handleDelete(row.id, row.employee_name)}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Recognitions"
        description="Manage Monthly Achievers and Best Employees"
        action={
          <Button
            icon={<Plus className="w-5 h-5" />}
            onClick={() => openCreateModal(activeTab)}
          >
            Add Recognition
          </Button>
        }
      />

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('MONTHLY_ACHIEVER')}
              className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
                activeTab === 'MONTHLY_ACHIEVER'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Award className="w-4 h-4" />
              Monthly Achievers
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {recognitions.filter((r) => r.type === 'MONTHLY_ACHIEVER').length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('BEST_EMPLOYEE')}
              className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
                activeTab === 'BEST_EMPLOYEE'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Star className="w-4 h-4" />
              Best Employees
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {recognitions.filter((r) => r.type === 'BEST_EMPLOYEE').length}
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(item) => item.id}
          emptyMessage={`No ${activeTab === 'MONTHLY_ACHIEVER' ? 'Monthly Achievers' : 'Best Employees'} found.`}
        />
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={`Add ${formData.type === 'MONTHLY_ACHIEVER' ? 'Monthly Achiever' : 'Best Employee'}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Employee Name"
            value={formData.employee_name}
            onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.employee_email}
            onChange={(e) => setFormData({ ...formData, employee_email: e.target.value })}
          />
          <Input
            label="Designation"
            value={formData.designation}
            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
          />
          <Input
            label="Month"
            type="month"
            value={formData.month}
            onChange={(e) => setFormData({ ...formData, month: e.target.value })}
            required
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {imagePreview && (
              <div className="mt-2">
                <img src={imagePreview} alt="Preview" className="max-h-64 rounded-lg object-contain border border-gray-200" />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
