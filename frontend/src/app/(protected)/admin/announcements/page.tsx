'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import api from '@/lib/api';
import { format } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  category: 'GENERAL' | 'BANK_UPDATES' | 'SALES_REPORT';
  image_path?: string | null;
  author_name: string;
  author_email: string;
  created_at: string;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL' as 'GENERAL' | 'BANK_UPDATES' | 'SALES_REPORT',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get('/admin/announcements');
      const data = response.data;
      
      // Handle new format: { announcements: [...], total: ... }
      if (data?.announcements && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements);
      } 
      // Handle old format: direct array
      else if (Array.isArray(data)) {
        setAnnouncements(data);
      } 
      else {
        setAnnouncements([]);
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('content', formData.content);
      formDataToSend.append('category', formData.category);
      if (selectedImage) {
        formDataToSend.append('image', selectedImage);
      }

      await api.post('/admin/announcements', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setModalOpen(false);
      setFormData({ title: '', content: '', category: 'GENERAL' });
      setSelectedImage(null);
      setImagePreview(null);
      fetchAnnouncements();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/announcements/${id}`);
      fetchAnnouncements();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete announcement');
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Announcement',
      render: (item: Announcement) => (
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium">{item.title}</div>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              item.category === 'BANK_UPDATES' 
                ? 'bg-blue-100 text-blue-700' 
                : item.category === 'SALES_REPORT'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {item.category === 'BANK_UPDATES' ? 'Bank Updates' : 
               item.category === 'SALES_REPORT' ? 'Sales Report' : 
               'General'}
            </span>
          </div>
          <div className="text-sm text-gray-500 line-clamp-1">{item.content}</div>
        </div>
      ),
    },
    {
      key: 'author',
      header: 'Author',
      render: (item: Announcement) => (
        <div className="text-sm">
          <div>{item.author_name}</div>
          <div className="text-gray-500">{item.author_email}</div>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (item: Announcement) => (
        <span className="text-sm text-gray-700">
          {format(new Date(item.created_at), 'MMM dd, yyyy')}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (item: Announcement) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            item.is_active
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {item.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Announcement) => (
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Edit className="w-4 h-4" />} onClick={() => {}}>
            Edit
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => handleDelete(item.id, item.title)}
          >
            Delete
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
        title="Announcements"
        description="Manage company announcements"
        action={
          <Button icon={<Plus className="w-5 h-5" />} onClick={() => setModalOpen(true)}>
            Create Announcement
          </Button>
        }
      />

      <Table columns={columns} data={announcements} keyExtractor={(item) => item.id} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Announcement">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Content
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              rows={5}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as 'GENERAL' | 'BANK_UPDATES' | 'SALES_REPORT' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            >
              <option value="GENERAL">General Announcement</option>
              <option value="BANK_UPDATES">Bank Updates</option>
              <option value="SALES_REPORT">Sales Report</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Image (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            />
            {imagePreview && (
              <div className="mt-2">
                <img src={imagePreview} alt="Preview" className="max-w-full h-48 object-cover rounded-lg border border-gray-300" />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="secondary" type="button" onClick={() => {
              setModalOpen(false);
              setFormData({ title: '', content: '', category: 'GENERAL' });
              setSelectedImage(null);
              setImagePreview(null);
            }}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create Announcement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

