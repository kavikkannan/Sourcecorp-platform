'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Dropdown from '@/components/Dropdown';
import api from '@/lib/api';

interface Team {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await api.get('/admin/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/admin/teams', formData);
      setModalOpen(false);
      setFormData({ name: '', description: '' });
      fetchTeams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create team');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the team "${name}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/teams/${id}`);
      fetchTeams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete team');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Team Name',
      render: (team: Team) => (
        <div>
          <div className="font-medium">{team.name}</div>
          {team.description && (
            <div className="text-sm text-gray-500">{team.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'member_count',
      header: 'Members',
      render: (team: Team) => (
        <span className="text-gray-700">{team.member_count}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (team: Team) => (
        <div className="flex justify-end">
          <Dropdown
            items={[
              {
                label: 'Edit Team',
                onClick: () => {},
                icon: <Edit className="w-4 h-4" />,
              },
              {
                label: 'Delete Team',
                onClick: () => handleDelete(team.id, team.name),
                icon: <Trash2 className="w-4 h-4" />,
                variant: 'danger',
              },
            ]}
          />
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
        title="Teams"
        description="Manage teams and team members"
        action={
          <Button icon={<Plus className="w-5 h-5" />} onClick={() => setModalOpen(true)}>
            Create Team
          </Button>
        }
      />

      <Table columns={columns} data={teams} keyExtractor={(team) => team.id} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Team">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Team Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create Team
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

