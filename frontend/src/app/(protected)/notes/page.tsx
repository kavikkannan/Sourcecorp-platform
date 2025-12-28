'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, X, StickyNote, Briefcase, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import { 
  noteService, 
  Note,
  getVisibilityColor,
  getVisibilityLabel,
} from '@/lib/notes';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

export default function NotesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'all'>('personal');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    content: '',
    visibility: 'PRIVATE' as 'PRIVATE' | 'CASE',
    linkedCaseId: '',
  });

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'personal') {
        const notesData = await noteService.getMyNotes();
        setNotes(notesData);
      } else {
        // For "all" tab, we'd need to fetch all notes user has access to
        // For now, just show personal notes
        const notesData = await noteService.getMyNotes();
        setNotes(notesData);
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await noteService.createNote({
        content: formData.content,
        linkedCaseId: formData.visibility === 'CASE' ? formData.linkedCaseId || null : null,
        visibility: formData.visibility,
      });
      
      setCreateModalOpen(false);
      setFormData({ content: '', visibility: 'PRIVATE', linkedCaseId: '' });
      fetchNotes();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await noteService.deleteNote(noteId);
      fetchNotes();
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete note');
    }
  };

  return (
    <div>
      <PageHeader
        title="Notes"
        description="Manage your personal and case-linked notes"
        action={
          <Button
            icon={<Plus className="w-5 h-5" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Note
          </Button>
        }
      />

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('personal')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'personal'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Personal Notes
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'all'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Notes
            </button>
          </nav>
        </div>
      </div>

      {/* Notes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <StickyNote className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No notes found.</p>
          </div>
        ) : (
          notes.map((note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedNote(note)}
            >
              <div className="flex items-start justify-between mb-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getVisibilityColor(note.visibility)}`}>
                  {getVisibilityLabel(note.visibility)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(note.id);
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-900 mb-3 line-clamp-3">{note.content}</p>
              {note.linked_case && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <Briefcase className="w-4 h-4" />
                  <span>{note.linked_case.case_number}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{format(new Date(note.created_at), 'MMM dd, yyyy')}</span>
                {note.creator && (
                  <span>{note.creator.first_name} {note.creator.last_name}</span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Note Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setFormData({ content: '', visibility: 'PRIVATE', linkedCaseId: '' });
        }}
        title="Create Note"
      >
        <form onSubmit={handleCreateNote} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              rows={6}
              required
              placeholder="Write your note here..."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Visibility</label>
            <select
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value as any, linkedCaseId: '' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              required
            >
              <option value="PRIVATE">Private (Personal Note)</option>
              <option value="CASE">Case (Linked to Case)</option>
            </select>
          </div>

          {formData.visibility === 'CASE' && (
            <Input
              label="Case ID"
              value={formData.linkedCaseId}
              onChange={(e) => setFormData({ ...formData, linkedCaseId: e.target.value })}
              placeholder="Enter case ID"
              required={formData.visibility === 'CASE'}
            />
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setCreateModalOpen(false);
                setFormData({ content: '', visibility: 'PRIVATE', linkedCaseId: '' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create Note
            </Button>
          </div>
        </form>
      </Modal>

      {/* Note Detail Modal */}
      <AnimatePresence>
        {selectedNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedNote(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getVisibilityColor(selectedNote.visibility)}`}>
                      {getVisibilityLabel(selectedNote.visibility)}
                    </span>
                    {selectedNote.linked_case && (
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Briefcase className="w-4 h-4" />
                        {selectedNote.linked_case.case_number}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    Created {format(new Date(selectedNote.created_at), 'MMM dd, yyyy HH:mm')}
                    {selectedNote.creator && (
                      <span> by {selectedNote.creator.first_name} {selectedNote.creator.last_name}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNote(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="prose max-w-none">
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedNote.content}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

