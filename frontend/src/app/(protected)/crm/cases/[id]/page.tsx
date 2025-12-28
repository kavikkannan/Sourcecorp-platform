'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  DollarSign,
  Calendar,
  FileText,
  Upload,
  Download,
  MessageSquare,
  UserPlus,
  RefreshCw,
  Bell,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  crmService,
  Case,
  Document,
  Note,
  TimelineEvent,
  ScheduleableUser,
  CaseNotification,
  LOAN_TYPES,
  CASE_STATUSES,
  getStatusColor,
  getStatusLabel,
} from '@/lib/crm';

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notifications, setNotifications] = useState<CaseNotification[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Form states
  const [assignUserId, setAssignUserId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Schedule states
  const [scheduleableUsers, setScheduleableUsers] = useState<{ above: ScheduleableUser[]; below: ScheduleableUser[] }>({ above: [], below: [] });
  const [selectedScheduleUser, setSelectedScheduleUser] = useState('');
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [loadingScheduleUsers, setLoadingScheduleUsers] = useState(false);

  const loadCaseData = useCallback(async () => {
    try {
      setLoading(true);
      const [caseResponse, docsResponse, notesResponse, notificationsResponse, timelineResponse] = await Promise.all([
        crmService.getCaseById(caseId),
        crmService.getDocuments(caseId),
        crmService.getNotes(caseId),
        crmService.getCaseNotifications(caseId),
        crmService.getTimeline(caseId),
      ]);

      setCaseData(caseResponse);
      setDocuments(docsResponse.documents);
      setNotes(notesResponse.notes);
      setNotifications(notificationsResponse.notifications);
      setTimeline(timelineResponse.timeline);
    } catch (error) {
      console.error('Failed to load case:', error);
      alert('Failed to load case details');
      router.push('/crm/cases');
    } finally {
      setLoading(false);
    }
  }, [caseId, router]);

  useEffect(() => {
    loadCaseData();
  }, [loadCaseData]);

  const loadScheduleableUsers = useCallback(async () => {
    try {
      setLoadingScheduleUsers(true);
      const users = await crmService.getScheduleableUsers();
      setScheduleableUsers(users);
    } catch (error) {
      console.error('Failed to load scheduleable users:', error);
      alert('Failed to load scheduleable users');
    } finally {
      setLoadingScheduleUsers(false);
    }
  }, []);

  useEffect(() => {
    if (showScheduleModal) {
      loadScheduleableUsers();
    }
  }, [showScheduleModal, loadScheduleableUsers]);

  const handleAssign = async () => {
    if (!assignUserId) return;
    try {
      setSubmitting(true);
      await crmService.assignCase(caseId, assignUserId);
      setShowAssignModal(false);
      setAssignUserId('');
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign case');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    try {
      setSubmitting(true);
      await crmService.updateStatus(caseId, newStatus, statusRemarks);
      setShowStatusModal(false);
      setNewStatus('');
      setStatusRemarks('');
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      setSubmitting(true);
      await crmService.uploadDocument(caseId, selectedFile);
      setShowUploadModal(false);
      setSelectedFile(null);
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to upload document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      setSubmitting(true);
      await crmService.addNote(caseId, newNote);
      setShowNoteModal(false);
      setNewNote('');
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedScheduleUser || !scheduleDateTime) return;
    try {
      setSubmitting(true);
      await crmService.scheduleNotification(caseId, {
        scheduled_for: selectedScheduleUser,
        message: scheduleMessage || undefined,
        scheduled_at: new Date(scheduleDateTime).toISOString(),
      });
      setShowScheduleModal(false);
      setSelectedScheduleUser('');
      setScheduleMessage('');
      setScheduleDateTime('');
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to schedule notification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      const blob = await crmService.downloadDocument(documentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Failed to download document');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return null;
  }

  return (
    <div>
      <PageHeader
        title={caseData.case_number}
        description={`${getStatusLabel(caseData.current_status)} - ${caseData.customer_name}`}
        action={
          <Button variant="secondary" onClick={() => router.push('/crm/cases')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cases
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Overview Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Case Overview</h2>
              <div className="flex items-center gap-3 mt-2">
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(caseData.current_status)}`}>
                  {getStatusLabel(caseData.current_status)}
                </span>
                {caseData.current_assignee && (
                  <span className="text-sm text-gray-600">
                    Assigned to <span className="font-medium">{caseData.current_assignee.name}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasPermission('crm.case.assign') && (
                <Button variant="secondary" onClick={() => setShowAssignModal(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign
                </Button>
              )}
              {hasPermission('crm.case.update_status') && (
                <Button variant="secondary" onClick={() => setShowStatusModal(true)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Update Status
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Customer Information</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="text-sm font-medium text-gray-900">{caseData.customer_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900">{caseData.customer_email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{caseData.customer_phone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Loan Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Loan Information</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Loan Type</p>
                    <p className="text-sm font-medium text-gray-900">
                      {LOAN_TYPES.find(t => t.value === caseData.loan_type)?.label || caseData.loan_type}
                    </p>
                  </div>
                </div>
                {caseData.source_type && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Source Type</p>
                      <p className="text-sm font-medium text-gray-900">{caseData.source_type}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Loan Amount</p>
                    <p className="text-lg font-semibold text-gray-900">${caseData.loan_amount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium text-gray-900">{new Date(caseData.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RefreshCw className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Last Updated</p>
                    <p className="text-sm font-medium text-gray-900">{new Date(caseData.updated_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Status & Assignment</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-2">Current Status</p>
              <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-full ${getStatusColor(caseData.current_status)}`}>
                {getStatusLabel(caseData.current_status)}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Assigned To</p>
              {caseData.current_assignee ? (
                <div>
                  <p className="text-sm font-medium text-gray-900">{caseData.current_assignee.name}</p>
                  <p className="text-xs text-gray-500">{caseData.current_assignee.email}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Not assigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Documents ({documents.length})</h2>
            {hasPermission('crm.case.upload_document') && (
              <Button variant="secondary" onClick={() => setShowUploadModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-gray-900 truncate">{doc.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {(doc.file_size / 1024).toFixed(2)} KB • {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => handleDownload(doc.id, doc.file_name)}
                    className="ml-2 flex-shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes & Scheduled Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Notes & Scheduled ({notes.length + notifications.length})
            </h2>
            <div className="flex gap-2">
              {hasPermission('crm.case.add_note') && (
                <>
                  <Button variant="secondary" onClick={() => setShowNoteModal(true)}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                  <Button variant="secondary" onClick={() => setShowScheduleModal(true)}>
                    <Bell className="w-4 h-4 mr-2" />
                    Schedule
                  </Button>
                </>
              )}
            </div>
          </div>
          {notes.length === 0 && notifications.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No notes or scheduled items yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Notes */}
              {notes.map((note) => (
                <div key={`note-${note.id}`} className="border-l-4 border-primary-500 pl-4 py-3 bg-gray-50 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-primary-600" />
                    <span className="text-xs font-medium text-primary-600">Note</span>
                  </div>
                  <p className="text-sm text-gray-900 mb-2">{note.note}</p>
                  <p className="text-xs text-gray-500">
                    {note.creator?.name} • {new Date(note.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              
              {/* Scheduled Notifications */}
              {notifications.map((notification) => (
                <div key={`notification-${notification.id}`} className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600">Scheduled</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        Scheduled for: {notification.scheduled_for.first_name} {notification.scheduled_for.last_name}
                      </p>
                      {notification.message && (
                        <p className="text-sm text-gray-700 mb-2">{notification.message}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>
                          Scheduled by: {notification.scheduled_by.first_name} {notification.scheduled_by.last_name}
                        </span>
                        <span>•</span>
                        <span>Scheduled for: {new Date(notification.scheduled_at).toLocaleString()}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-full ${
                          notification.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          notification.status === 'SENT' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {notification.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h2>
          {timeline.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm text-gray-500">No activity recorded yet</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-6">
                {timeline.map((event, index) => (
                  <div key={event.id} className="relative flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center border-2 border-white">
                      <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                    </div>
                    <div className="flex-1 pb-6">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {event.type === 'status_change' && `Status changed to ${getStatusLabel(event.details.to_status)}`}
                        {event.type === 'assignment' && `Assigned to ${event.details.assignee_name}`}
                        {event.type === 'note' && 'Note added'}
                        {event.type === 'document' && `Document uploaded: ${event.details.file_name}`}
                        {event.type === 'notification' && (
                          <>
                            Notification scheduled for {event.details.scheduled_for?.first_name} {event.details.scheduled_for?.last_name} 
                            {' '}on {new Date(event.details.scheduled_at).toLocaleString()}
                            {event.details.message && `: ${event.details.message}`}
                          </>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {event.user.name} • {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Case">
        <div className="space-y-4">
          <Input
            label="User ID"
            value={assignUserId}
            onChange={(e) => setAssignUserId(e.target.value)}
            placeholder="Enter user UUID"
            required
          />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAssignModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleAssign} className="flex-1" disabled={submitting || !assignUserId}>
              {submitting ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status Modal */}
      <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Status">
        <div className="space-y-4">
          <Select
            label="New Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            required
            options={[
              { value: '', label: 'Select status' },
              ...CASE_STATUSES.map(status => ({ value: status.value, label: status.label }))
            ]}
          />
          <Input
            label="Remarks (optional)"
            value={statusRemarks}
            onChange={(e) => setStatusRemarks(e.target.value)}
            placeholder="Add any remarks"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowStatusModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleStatusUpdate} className="flex-1" disabled={submitting || !newStatus}>
              {submitting ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Document">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select File</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowUploadModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleUpload} className="flex-1" disabled={submitting || !selectedFile}>
              {submitting ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Note Modal */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title="Add Note">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter your note..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowNoteModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleAddNote} className="flex-1" disabled={submitting || !newNote.trim()}>
              {submitting ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setSelectedScheduleUser('');
          setScheduleMessage('');
          setScheduleDateTime('');
        }}
        title="Schedule Notification"
      >
        <div className="space-y-4">
          {loadingScheduleUsers ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <p className="mt-2 text-sm text-gray-600">Loading users...</p>
            </div>
          ) : (
            <>
              <Select
                label="Schedule For"
                value={selectedScheduleUser}
                onChange={(e) => setSelectedScheduleUser(e.target.value)}
                required
                options={[
                  { value: '', label: 'Select user' },
                  ...(scheduleableUsers.above.length > 0
                    ? [
                        {
                          value: 'above_header',
                          label: '--- Managers (Above) ---',
                          disabled: true,
                        },
                        ...scheduleableUsers.above.map((u) => ({
                          value: u.id,
                          label: `${u.firstName} ${u.lastName} (${u.email})`,
                        })),
                      ]
                    : []),
                  ...(scheduleableUsers.below.length > 0
                    ? [
                        {
                          value: 'below_header',
                          label: '--- Subordinates (Below) ---',
                          disabled: true,
                        },
                        ...scheduleableUsers.below.map((u) => ({
                          value: u.id,
                          label: `${u.firstName} ${u.lastName} (${u.email})`,
                        })),
                      ]
                    : []),
                ]}
              />
              {scheduleableUsers.above.length === 0 && scheduleableUsers.below.length === 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    No users available in your hierarchy. You can only schedule notifications for users above or below you in the hierarchy within the same team.
                  </p>
                </div>
              )}
              <Input
                label="Date & Time"
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message (Optional)</label>
                <textarea
                  value={scheduleMessage}
                  onChange={(e) => setScheduleMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter notification message..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setShowScheduleModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSchedule}
                  className="flex-1"
                  disabled={
                    submitting ||
                    !selectedScheduleUser ||
                    !scheduleDateTime ||
                    selectedScheduleUser === 'above_header' ||
                    selectedScheduleUser === 'below_header'
                  }
                >
                  {submitting ? 'Scheduling...' : 'Schedule'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

