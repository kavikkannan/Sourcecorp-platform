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
  X,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Trash2,
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
import { api } from '@/lib/api';
import { formatIndianCurrency } from '@/utils/formatNumber';
import JSZip from 'jszip';

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
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCustomerDetailUploadModal, setShowCustomerDetailUploadModal] = useState(false);
  const [showCustomerDetailViewModal, setShowCustomerDetailViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [customerDetailSheet, setCustomerDetailSheet] = useState<any>(null);
  const [customerDetailFile, setCustomerDetailFile] = useState<File | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [templateFields, setTemplateFields] = useState<any[]>([]);
  
  // Customer detail edit/request change states
  const [isEditingCustomerDetails, setIsEditingCustomerDetails] = useState(false);
  const [editedCustomerDetails, setEditedCustomerDetails] = useState<Record<string, any>>({});
  const [showRequestChangeModal, setShowRequestChangeModal] = useState(false);
  const [availableApprovers, setAvailableApprovers] = useState<any[]>([]);
  const [selectedApprover, setSelectedApprover] = useState('');
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  
  // Case overview edit/request change states
  const [isEditingCaseOverview, setIsEditingCaseOverview] = useState(false);
  const [editedCaseData, setEditedCaseData] = useState<Partial<Case>>({});
  const [showCaseRequestChangeModal, setShowCaseRequestChangeModal] = useState(false);

  // Form states
  const [assignUserId, setAssignUserId] = useState('');
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; firstName: string; lastName: string; email: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Schedule states
  const [scheduleableUsers, setScheduleableUsers] = useState<{ above: ScheduleableUser[]; below: ScheduleableUser[] }>({ above: [], below: [] });
  const [selectedScheduleUser, setSelectedScheduleUser] = useState('');
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [loadingScheduleUsers, setLoadingScheduleUsers] = useState(false);
  
  // Pagination for notes & schedule
  const [showAllItems, setShowAllItems] = useState(false);
  const itemsPerPage = 10;
  
  // Preview modal state
  const [previewDocument, setPreviewDocument] = useState<{
    id: string;
    fileName: string;
    mimeType: string;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

      // Try to load customer detail sheet (don't fail if not found)
      try {
        const detailSheet = await crmService.getCustomerDetailSheet(caseId);
        setCustomerDetailSheet(detailSheet);
      } catch (error: any) {
        if (error.response?.status !== 404) {
        }
        setCustomerDetailSheet(null);
      }

      // Load template fields
      try {
        const template = await crmService.getCustomerDetailTemplate();
        setTemplateFields(template);
      } catch (error) {
        setTemplateFields([]);
      }

      // Load change requests
      try {
        const changeRequestsData = await crmService.getCustomerDetailChangeRequests(caseId);
        setChangeRequests(changeRequestsData);
      } catch (error) {
        setChangeRequests([]);
      }

      setCaseData(caseResponse);
      setDocuments(docsResponse.documents);
      setNotes(notesResponse.notes);
      setNotifications(notificationsResponse.notifications);
      setTimeline(timelineResponse.timeline);
      // Reset view to show only top items when data is reloaded
      setShowAllItems(false);
    } catch (error) {
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

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await api.get('/admin/users');
      // Filter only active users
      const activeUsers = response.data
        .filter((user: any) => user.isActive)
        .map((user: any) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        }));
      setAvailableUsers(activeUsers);
    } catch (error) {
      alert('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (showAssignModal) {
      loadUsers();
    }
  }, [showAssignModal, loadUsers]);

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

  const handleDelete = () => {
    setShowDeleteModal(true);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm deletion');
      return;
    }
    try {
      setSubmitting(true);
      await crmService.deleteCase(caseId);
      alert('Case deleted successfully');
      router.push('/crm/cases');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete case');
    } finally {
      setSubmitting(false);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
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
    if (selectedFiles.length === 0) return;
    try {
      setSubmitting(true);
      // Upload all files sequentially
      for (const file of selectedFiles) {
        await crmService.uploadDocument(caseId, file);
      }
      setShowUploadModal(false);
      setSelectedFiles([]);
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to upload document(s)');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      setSubmitting(true);
      await crmService.addNote(caseId, newNote, noteFile || undefined);
      setShowNoteModal(false);
      setNewNote('');
      setNoteFile(null);
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
      }, scheduleFile || undefined);
      setShowScheduleModal(false);
      setSelectedScheduleUser('');
      setScheduleMessage('');
      setScheduleDateTime('');
      setScheduleFile(null);
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
      
      // Get case name for folder
      const caseName = caseData?.case_number || `Case-${caseId.substring(0, 8)}`;
      
      // Create zip file with folder structure
      const zip = new JSZip();
      const caseFolder = zip.folder(caseName);
      if (caseFolder) {
        caseFolder.file(fileName, blob);
      }
      
      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download the zip file
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${caseName}_${fileName}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert(`Document saved as zip: ${caseName}/${fileName}`);
    } catch (error) {
      alert('Failed to download document');
    }
  };

  const handleDownloadMultiple = async (documentIds: Array<{ id: string; fileName: string }>) => {
    if (documentIds.length === 0) return;
    
    try {
      const caseName = caseData?.case_number || `Case-${caseId.substring(0, 8)}`;
      
      // Create zip file with folder structure
      const zip = new JSZip();
      const caseFolder = zip.folder(caseName);
      if (caseFolder) {
        // Download all files and add to zip
        for (let i = 0; i < documentIds.length; i++) {
          const doc = documentIds[i];
          const blob = await crmService.downloadDocument(doc.id);
          caseFolder.file(doc.fileName, blob);
        }
      }
      
      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download the zip file
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${caseName}_documents.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert(`All ${documentIds.length} document(s) saved as zip: ${caseName}/`);
    } catch (error) {
      alert('Failed to download documents');
    }
  };

  const handlePreview = async (documentId: string, fileName: string, mimeType: string) => {
    try {
      setPreviewLoading(true);
      setPreviewDocument({ id: documentId, fileName, mimeType });
      
      const blob = await crmService.downloadDocument(documentId);
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewLoading(false);
    } catch (error) {
      alert('Failed to load preview');
      setPreviewLoading(false);
      setPreviewDocument(null);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewDocument(null);
    setPreviewUrl(null);
    setPreviewLoading(false);
  };

  const isImage = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  const isPDF = (mimeType: string) => {
    return mimeType === 'application/pdf';
  };

  const handleMarkNotificationRead = async (notificationId: string, isRead: boolean) => {
    try {
      await crmService.markNotificationRead(notificationId, isRead);
      loadCaseData(); // Reload to get updated status
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update notification status');
    }
  };

  const handleMarkNotificationCompletion = async (notificationId: string, status: 'ONGOING' | 'COMPLETED') => {
    try {
      await crmService.markNotificationCompletion(notificationId, status);
      loadCaseData(); // Reload to get updated completion status
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update completion status');
    }
  };

  const handleUploadCustomerDetailSheet = async () => {
    if (!customerDetailFile) return;
    try {
      setSubmitting(true);
      await crmService.uploadCustomerDetailSheet(caseId, customerDetailFile);
      setShowCustomerDetailUploadModal(false);
      setCustomerDetailFile(null);
      loadCaseData(); // Reload to get updated detail sheet
      alert('Customer detail sheet uploaded successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to upload customer detail sheet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewCustomerDetailSheet = () => {
    if (customerDetailSheet) {
      setShowCustomerDetailViewModal(true);
      setShowMoreDetails(true);
      setIsEditingCustomerDetails(false);
      setEditedCustomerDetails({});
    }
  };

  const handleEditCustomerDetails = () => {
    if (customerDetailSheet) {
      setIsEditingCustomerDetails(true);
      setEditedCustomerDetails({ ...customerDetailSheet.detail_data });
    }
  };

  const handleCancelEditCustomerDetails = () => {
    setIsEditingCustomerDetails(false);
    setEditedCustomerDetails({});
  };

  const handleSaveCustomerDetails = async () => {
    if (!hasPermission('crm.case.customer_details.modify')) {
      alert('You do not have permission to modify customer details directly');
      return;
    }

    // Calculate the changes
    const originalData = customerDetailSheet?.detail_data || {};
    const changes: Record<string, any> = {};
    
    Object.keys(editedCustomerDetails).forEach(key => {
      if (editedCustomerDetails[key] !== originalData[key]) {
        changes[key] = editedCustomerDetails[key];
      }
    });

    if (Object.keys(changes).length === 0) {
      alert('No changes to save');
      setIsEditingCustomerDetails(false);
      return;
    }

    try {
      setSubmitting(true);
      // For users with modify permission, we can directly update
      // Since there's no direct update API, we'll create a self-approved change request
      // In the future, this should call a direct update endpoint
      const currentUserId = user?.id;
      if (!currentUserId) {
        throw new Error('User not found');
      }

      // Create change request to self (auto-approved)
      await crmService.createCustomerDetailChangeRequest(caseId, currentUserId, changes);
      // Auto-approve it
      const changeRequests = await crmService.getCustomerDetailChangeRequests(caseId);
      const latestRequest = changeRequests.find((r: any) => 
        r.requested_by.id === currentUserId && 
        r.requested_for.id === currentUserId && 
        r.status === 'PENDING'
      );
      
      if (latestRequest) {
        await crmService.approveCustomerDetailChangeRequest(latestRequest.id);
      }

      alert('Customer details updated successfully');
      setIsEditingCustomerDetails(false);
      setEditedCustomerDetails({});
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save changes');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChange = async () => {
    if (!selectedApprover) {
      alert('Please select an approver');
      return;
    }

    if (Object.keys(editedCustomerDetails).length === 0) {
      alert('No changes to request');
      return;
    }

    // Calculate the changes (only fields that were modified)
    const changes: Record<string, any> = {};
    const originalData = customerDetailSheet?.detail_data || {};
    
    Object.keys(editedCustomerDetails).forEach(key => {
      if (editedCustomerDetails[key] !== originalData[key]) {
        changes[key] = editedCustomerDetails[key];
      }
    });

    if (Object.keys(changes).length === 0) {
      alert('No changes detected');
      return;
    }

    try {
      setSubmitting(true);
      await crmService.createCustomerDetailChangeRequest(caseId, selectedApprover, changes);
      alert('Change request submitted successfully');
      setShowRequestChangeModal(false);
      setSelectedApprover('');
      setIsEditingCustomerDetails(false);
      setEditedCustomerDetails({});
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to submit change request');
    } finally {
      setSubmitting(false);
    }
  };

  const loadAvailableApprovers = async (): Promise<boolean> => {
    try {
      setLoadingApprovers(true);
      const users = await crmService.getUsersWithModifyPermission();
      setAvailableApprovers(users);
      
      if (users.length === 0) {
        alert('No users with modify permission found above you in the hierarchy. Please contact your administrator.');
        return false;
      }
      
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load approvers';
      alert(`Error loading approvers: ${errorMessage}`);
      return false;
    } finally {
      setLoadingApprovers(false);
    }
  };

  const handleOpenRequestChangeModal = async () => {
    // Calculate changes before opening modal
    const originalData = customerDetailSheet?.detail_data || {};
    const hasChanges = Object.keys(editedCustomerDetails).some(
      key => editedCustomerDetails[key] !== originalData[key]
    );

    if (!hasChanges) {
      alert('No changes to request');
      return;
    }

    const success = await loadAvailableApprovers();
    if (success) {
      setShowRequestChangeModal(true);
    }
  };

  const handleApproveChangeRequest = async (requestId: string, remarks?: string) => {
    try {
      setSubmitting(true);
      await crmService.approveCustomerDetailChangeRequest(requestId, remarks);
      alert('Change request approved successfully');
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve change request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectChangeRequest = async (requestId: string, remarks?: string) => {
    if (!remarks || !remarks.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    try {
      setSubmitting(true);
      await crmService.rejectCustomerDetailChangeRequest(requestId, remarks);
      alert('Change request rejected');
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject change request');
    } finally {
      setSubmitting(false);
    }
  };

  // Case Overview Edit Handlers
  const handleEditCaseOverview = () => {
    if (caseData) {
      setIsEditingCaseOverview(true);
      setEditedCaseData({
        customer_name: caseData.customer_name,
        customer_email: caseData.customer_email,
        customer_phone: caseData.customer_phone,
        loan_type: caseData.loan_type,
        loan_amount: caseData.loan_amount,
        source_type: caseData.source_type,
      });
    } else {
      alert('Case data not loaded. Please refresh the page.');
    }
  };

  const handleCancelEditCaseOverview = () => {
    setIsEditingCaseOverview(false);
    setEditedCaseData({});
  };

  const handleSaveCaseOverview = async () => {
    if (!hasPermission('crm.case.customer_details.modify')) {
      alert('You do not have permission to modify case details directly');
      return;
    }

    // Calculate the changes
    const changes: Record<string, any> = {};
    if (caseData) {
      if (editedCaseData.customer_name !== caseData.customer_name) changes.customer_name = editedCaseData.customer_name;
      if (editedCaseData.customer_email !== caseData.customer_email) changes.customer_email = editedCaseData.customer_email;
      if (editedCaseData.customer_phone !== caseData.customer_phone) changes.customer_phone = editedCaseData.customer_phone;
      if (editedCaseData.loan_type !== caseData.loan_type) changes.loan_type = editedCaseData.loan_type;
      if (editedCaseData.loan_amount !== caseData.loan_amount) changes.loan_amount = editedCaseData.loan_amount;
      if (editedCaseData.source_type !== caseData.source_type) changes.source_type = editedCaseData.source_type;
    }

    if (Object.keys(changes).length === 0) {
      alert('No changes to save');
      setIsEditingCaseOverview(false);
      return;
    }

    try {
      setSubmitting(true);
      // For users with modify permission, create self-approved change request
      const currentUserId = user?.id;
      if (!currentUserId) {
        throw new Error('User not found');
      }

      await crmService.createCustomerDetailChangeRequest(caseId, currentUserId, changes);
      const changeRequests = await crmService.getCustomerDetailChangeRequests(caseId);
      const latestRequest = changeRequests.find((r: any) => 
        r.requested_by.id === currentUserId && 
        r.requested_for.id === currentUserId && 
        r.status === 'PENDING'
      );
      
      if (latestRequest) {
        await crmService.approveCustomerDetailChangeRequest(latestRequest.id);
      }

      alert('Case details updated successfully');
      setIsEditingCaseOverview(false);
      setEditedCaseData({});
      loadCaseData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save changes');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestCaseChange = async () => {
    if (!selectedApprover) {
      alert('Please select an approver');
      return;
    }

    // Calculate the changes
    const changes: Record<string, any> = {};
    if (caseData) {
      if (editedCaseData.customer_name !== caseData.customer_name) {
        changes.customer_name = editedCaseData.customer_name;
      }
      if (editedCaseData.customer_email !== caseData.customer_email) {
        changes.customer_email = editedCaseData.customer_email;
      }
      if (editedCaseData.customer_phone !== caseData.customer_phone) {
        changes.customer_phone = editedCaseData.customer_phone;
      }
      if (editedCaseData.loan_type !== caseData.loan_type) {
        changes.loan_type = editedCaseData.loan_type;
      }
      if (editedCaseData.loan_amount !== caseData.loan_amount) {
        changes.loan_amount = editedCaseData.loan_amount;
      }
      if (editedCaseData.source_type !== caseData.source_type) {
        changes.source_type = editedCaseData.source_type;
      }
    }

    if (Object.keys(changes).length === 0) {
      alert('No changes to request');
      return;
    }

    try {
      setSubmitting(true);
      await crmService.createCustomerDetailChangeRequest(caseId, selectedApprover, changes);
      alert('Change request submitted successfully');
      setShowCaseRequestChangeModal(false);
      setSelectedApprover('');
      setIsEditingCaseOverview(false);
      setEditedCaseData({});
      await loadCaseData();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to submit change request';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCaseRequestChangeModal = () => {
    if (!caseData) {
      alert('Case data not loaded');
      return;
    }

    // Open modal immediately
    setShowCaseRequestChangeModal(true);
    
    // Load approvers in the background (don't wait for it)
    loadAvailableApprovers().catch((error: any) => {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load approvers';
      alert(`Warning: ${errorMessage}. You can still try to submit the request.`);
    });
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
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Case Overview</h2>
                {!isEditingCaseOverview && (
                  <>
                    {hasPermission('crm.case.customer_details.modify') ? (
                      <Button variant="secondary" onClick={handleEditCaseOverview} className="text-xs px-2 py-1 h-7">
                        Edit
                      </Button>
                    ) : hasPermission('crm.case.customer_details.request_change') ? (
                      <Button 
                        variant="secondary" 
                        onClick={handleEditCaseOverview} 
                        className="text-xs px-2 py-1 h-7"
                      >
                        Edit & Request Change
                      </Button>
                    ) : null}
                  </>
                )}
                {isEditingCaseOverview && (
                  <>
                    {hasPermission('crm.case.customer_details.modify') ? (
                      <>
                        <Button variant="secondary" onClick={handleCancelEditCaseOverview} className="text-xs px-2 py-1 h-7">
                          Cancel
                        </Button>
                        <Button onClick={handleSaveCaseOverview} disabled={submitting} className="text-xs px-2 py-1 h-7">
                          {submitting ? 'Saving...' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={handleCancelEditCaseOverview} className="text-xs px-2 py-1 h-7">
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => handleOpenCaseRequestChangeModal()} 
                          disabled={submitting} 
                          className="text-xs px-2 py-1 h-7"
                        >
                          Request Change
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
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
              {hasPermission('crm.case.upload_document') && (
                <Button variant="secondary" onClick={() => setShowCustomerDetailUploadModal(true)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Upload Customer Detail Sheet
                </Button>
              )}
              {hasPermission('crm.case.delete') && (
                <Button 
                  variant="secondary" 
                  onClick={handleDelete}
                  disabled={submitting}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
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
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Name</p>
                    {isEditingCaseOverview ? (
                      <Input
                        value={editedCaseData.customer_name || ''}
                        onChange={(e) => setEditedCaseData({ ...editedCaseData, customer_name: e.target.value })}
                        className="text-sm mt-1"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{caseData.customer_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Email</p>
                    {isEditingCaseOverview ? (
                      <Input
                        type="email"
                        value={editedCaseData.customer_email || ''}
                        onChange={(e) => setEditedCaseData({ ...editedCaseData, customer_email: e.target.value })}
                        className="text-sm mt-1"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{caseData.customer_email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Phone</p>
                    {isEditingCaseOverview ? (
                      <Input
                        value={editedCaseData.customer_phone || ''}
                        onChange={(e) => setEditedCaseData({ ...editedCaseData, customer_phone: e.target.value })}
                        className="text-sm mt-1"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{caseData.customer_phone}</p>
                    )}
                  </div>
                </div>
                {customerDetailSheet && (
                  <button
                    onClick={handleViewCustomerDetailSheet}
                    className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 mt-2"
                  >
                    <ChevronDown className="w-4 h-4" />
                    View More
                  </button>
                )}
              </div>
            </div>

            {/* Loan Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Loan Information</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Loan Type</p>
                    {isEditingCaseOverview ? (
                      <Select
                        value={editedCaseData.loan_type || ''}
                        onChange={(e) => setEditedCaseData({ ...editedCaseData, loan_type: e.target.value })}
                        options={[
                          { value: '', label: 'Select loan type' },
                          ...LOAN_TYPES.map(t => ({ value: t.value, label: t.label }))
                        ]}
                        className="text-sm mt-1"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">
                        {LOAN_TYPES.find(t => t.value === caseData.loan_type)?.label || caseData.loan_type}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Source Type</p>
                    {isEditingCaseOverview ? (
                      <Select
                        value={editedCaseData.source_type || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEditedCaseData({ 
                            ...editedCaseData, 
                            source_type: value === '' ? null : (value === 'DSA' || value === 'DST' ? value as 'DSA' | 'DST' : null)
                          });
                        }}
                        options={[
                          { value: '', label: 'None' },
                          { value: 'DSA', label: 'DSA' },
                          { value: 'DST', label: 'DST' }
                        ]}
                        className="text-sm mt-1"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{caseData.source_type || 'Not specified'}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Loan Amount</p>
                    {isEditingCaseOverview ? (
                      <Input
                        type="number"
                        value={editedCaseData.loan_amount || ''}
                        onChange={(e) => setEditedCaseData({ ...editedCaseData, loan_amount: parseFloat(e.target.value) || 0 })}
                        className="text-sm mt-1"
                      />
                    ) : (
                      <p className="text-lg font-semibold text-gray-900">{formatIndianCurrency(caseData.loan_amount)}</p>
                    )}
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
            <div className="flex gap-2">
              {documents.length > 0 && (
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    const docs = documents.map(doc => ({ id: doc.id, fileName: doc.file_name }));
                    handleDownloadMultiple(docs);
                  }}
                  title="Download all documents to case folder"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </Button>
              )}
              {hasPermission('crm.case.upload_document') && (
                <Button variant="secondary" onClick={() => setShowUploadModal(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              )}
            </div>
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
                  <div 
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      if (isImage(doc.mime_type) || isPDF(doc.mime_type)) {
                        handlePreview(doc.id, doc.file_name, doc.mime_type);
                      }
                    }}
                    title={(isImage(doc.mime_type) || isPDF(doc.mime_type)) ? "Click to preview" : ""}
                  >
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium text-sm truncate ${(isImage(doc.mime_type) || isPDF(doc.mime_type)) ? 'text-primary-600 hover:text-primary-700' : 'text-gray-900'}`}>
                        {doc.file_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(doc.file_size / 1024).toFixed(2)} KB • {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    {(isImage(doc.mime_type) || isPDF(doc.mime_type)) && (
                      <Button
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(doc.id, doc.file_name, doc.mime_type);
                        }}
                        className="p-2"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(doc.id, doc.file_name);
                      }}
                      className="p-2"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
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
          {(() => {
            // Combine notes and notifications into a single array
            const combinedItems = [
              ...notes.map(note => ({
                type: 'note' as const,
                id: note.id,
                created_at: note.created_at,
                data: note,
              })),
              ...notifications.map(notification => ({
                type: 'notification' as const,
                id: notification.id,
                created_at: notification.created_at,
                data: notification,
              })),
            ].sort((a, b) => {
              // Sort by creation time, newest first
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });

            const totalItems = combinedItems.length;
            const displayedItems = showAllItems ? combinedItems : combinedItems.slice(0, itemsPerPage);
            const hasMore = totalItems > itemsPerPage;

            if (totalItems === 0) {
              return (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No notes or scheduled items yet</p>
                </div>
              );
            }

            return (
              <>
                <div className="space-y-4">
                  {displayedItems.map((item) => {
                    if (item.type === 'note') {
                      const note = item.data as Note;
                      return (
                        <div key={`note-${note.id}`} className="border-l-4 border-primary-500 pl-4 py-3 bg-gray-50 rounded-r-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="w-4 h-4 text-primary-600" />
                            <span className="text-xs font-medium text-primary-600">Note</span>
                          </div>
                          <p className="text-sm text-gray-900 mb-2">{note.note}</p>
                          {note.document && (
                            <div className="mb-2 flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <span 
                                className="text-xs text-gray-700 flex-1 truncate cursor-pointer hover:text-primary-600"
                                onClick={() => handlePreview(note.document!.id, note.document!.file_name, note.document!.mime_type)}
                                title="Click to preview"
                              >
                                {note.document.file_name}
                              </span>
                              <div className="flex gap-1">
                                {(isImage(note.document.mime_type) || isPDF(note.document.mime_type)) && (
                                  <Button
                                    variant="secondary"
                                    onClick={() => handlePreview(note.document!.id, note.document!.file_name, note.document!.mime_type)}
                                    className="p-1 h-6"
                                    title="Preview"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="secondary"
                                  onClick={() => handleDownload(note.document!.id, note.document!.file_name)}
                                  className="p-1 h-6"
                                  title="Download"
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-gray-500">
                            {note.creator?.name} • {new Date(note.created_at).toLocaleString()}
                          </p>
                        </div>
                      );
                    } else {
                      const notification = item.data as CaseNotification;
                      return (
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
                              {notification.document && (
                                <div className="mb-2 flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                                  <FileText className="w-4 h-4 text-gray-500" />
                                  <span 
                                    className="text-xs text-gray-700 flex-1 truncate cursor-pointer hover:text-primary-600"
                                    onClick={() => handlePreview(notification.document!.id, notification.document!.file_name, notification.document!.mime_type)}
                                    title="Click to preview"
                                  >
                                    {notification.document.file_name}
                                  </span>
                                  <div className="flex gap-1">
                                    {(isImage(notification.document.mime_type) || isPDF(notification.document.mime_type)) && (
                                      <Button
                                        variant="secondary"
                                        onClick={() => handlePreview(notification.document!.id, notification.document!.file_name, notification.document!.mime_type)}
                                        className="p-1 h-6"
                                        title="Preview"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="secondary"
                                      onClick={() => handleDownload(notification.document!.id, notification.document!.file_name)}
                                      className="p-1 h-6"
                                      title="Download"
                                    >
                                      <Download className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
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
                                {notification.completion_status && (
                                  <>
                                    <span>•</span>
                                    <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                      notification.completion_status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                      'bg-blue-100 text-blue-800'
                                    }`}>
                                      {notification.completion_status === 'COMPLETED' ? (
                                        <>
                                          <CheckCircle className="w-3 h-3" />
                                          Completed
                                        </>
                                      ) : (
                                        <>
                                          <Clock className="w-3 h-3" />
                                          Ongoing
                                        </>
                                      )}
                                    </span>
                                  </>
                                )}
                              </div>
                              {/* Action buttons for scheduled_for user */}
                              {user && notification.scheduled_for.id === user.id && (
                                <div className="flex gap-2 mt-3">
                                  {!notification.is_read && (
                                    <Button
                                      variant="secondary"
                                      onClick={() => handleMarkNotificationRead(notification.id, true)}
                                      className="text-xs px-3 py-1 h-7"
                                    >
                                      Mark as Read
                                    </Button>
                                  )}
                                  {notification.completion_status !== 'COMPLETED' && (
                                    <Button
                                      variant="secondary"
                                      onClick={() => handleMarkNotificationCompletion(notification.id, 'COMPLETED')}
                                      className="text-xs px-3 py-1 h-7"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Mark Complete
                                    </Button>
                                  )}
                                  {notification.completion_status === 'COMPLETED' && (
                                    <Button
                                      variant="secondary"
                                      onClick={() => handleMarkNotificationCompletion(notification.id, 'ONGOING')}
                                      className="text-xs px-3 py-1 h-7"
                                    >
                                      <Clock className="w-3 h-3 mr-1" />
                                      Mark Ongoing
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

      {/* Customer Detail Sheet Upload Modal */}
      <Modal
        isOpen={showCustomerDetailUploadModal}
        onClose={() => {
          setShowCustomerDetailUploadModal(false);
          setCustomerDetailFile(null);
        }}
        title="Upload Customer Detail Sheet"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload an Excel file (.xlsx or .xls) containing customer details. The file should have labels in column A and values in column B.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excel File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setCustomerDetailFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {customerDetailFile && (
              <p className="mt-2 text-xs text-gray-600 flex items-center gap-2">
                <FileSpreadsheet className="w-3 h-3" />
                {customerDetailFile.name}
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCustomerDetailUploadModal(false);
                setCustomerDetailFile(null);
              }}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadCustomerDetailSheet}
              className="flex-1"
              disabled={submitting || !customerDetailFile}
            >
              {submitting ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Customer Detail Sheet View Modal */}
      <Modal
        isOpen={showCustomerDetailViewModal}
        onClose={() => {
          setShowCustomerDetailViewModal(false);
          setShowMoreDetails(false);
          setIsEditingCustomerDetails(false);
          setEditedCustomerDetails({});
        }}
        title="Customer Detail Sheet"
      >
        {customerDetailSheet ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div></div>
              <div className="flex gap-2">
                {!isEditingCustomerDetails ? (
                  <>
                    {hasPermission('crm.case.customer_details.modify') ? (
                      <Button variant="secondary" onClick={handleEditCustomerDetails}>
                        Edit
                      </Button>
                    ) : hasPermission('crm.case.customer_details.request_change') ? (
                      <Button variant="secondary" onClick={handleEditCustomerDetails}>
                        Edit & Request Change
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <>
                    {hasPermission('crm.case.customer_details.modify') ? (
                      <>
                        <Button variant="secondary" onClick={handleCancelEditCustomerDetails}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveCustomerDetails} disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={handleCancelEditCustomerDetails}>
                          Cancel
                        </Button>
                        <Button onClick={handleOpenRequestChangeModal} disabled={submitting}>
                          Request Change
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                const visibleFields = templateFields.length > 0
                  ? templateFields.filter(f => f.is_visible).map(f => f.field_key)
                  : null;
                
                const dataToDisplay = isEditingCustomerDetails ? editedCustomerDetails : (customerDetailSheet.detail_data || {});
                
                return Object.entries(dataToDisplay)
                  .filter(([key]) => {
                    if (key.startsWith('raw_')) return false;
                    if (visibleFields === null) return true; // Show all if no template
                    return visibleFields.includes(key);
                  })
                  .sort(([keyA], [keyB]) => {
                    if (visibleFields === null) return 0;
                    const orderA = templateFields.find(f => f.field_key === keyA)?.display_order || 999;
                    const orderB = templateFields.find(f => f.field_key === keyB)?.display_order || 999;
                    return orderA - orderB;
                  })
                  .map(([key, value]: [string, any]) => {
                    const templateField = templateFields.find(f => f.field_key === key);
                    const formattedKey = templateField?.field_label || key
                      .split('_')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');
                    
                    const originalValue = customerDetailSheet.detail_data?.[key];
                    const hasChanged = isEditingCustomerDetails && value !== originalValue;
                    
                    return (
                      <div key={key} className={`p-3 rounded-lg ${hasChanged ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-gray-50'}`}>
                        <p className="text-xs text-gray-500 mb-1">{formattedKey}</p>
                        {isEditingCustomerDetails ? (
                          <Input
                            value={value || ''}
                            onChange={(e) => setEditedCustomerDetails({ ...editedCustomerDetails, [key]: e.target.value })}
                            className="text-sm"
                          />
                        ) : (
                          <p className="text-sm font-medium text-gray-900">{value || 'Not mentioned'}</p>
                        )}
                        {hasChanged && (
                          <p className="text-xs text-yellow-700 mt-1">
                            Original: {originalValue || 'Not mentioned'}
                          </p>
                        )}
                      </div>
                    );
                  });
              })()}
            </div>
            {Object.keys(customerDetailSheet.detail_data || {}).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No customer details available
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No customer detail sheet uploaded for this case
          </div>
        )}
      </Modal>

      {/* Request Change Modal (for Customer Detail Sheet) */}
      <Modal
        isOpen={showRequestChangeModal}
        onClose={() => {
          setShowRequestChangeModal(false);
          setSelectedApprover('');
        }}
        title="Request Change"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a user with modify permission to approve your changes:
          </p>
          <Select
            label="Select Approver"
            value={selectedApprover}
            onChange={(e) => setSelectedApprover(e.target.value)}
            required
            disabled={loadingApprovers}
            options={[
              { value: '', label: loadingApprovers ? 'Loading approvers...' : 'Select an approver' },
              ...availableApprovers.map(user => ({
                value: user.id,
                label: `${user.first_name} ${user.last_name} (${user.email})`
              }))
            ]}
          />
          {availableApprovers.length === 0 && !loadingApprovers && (
            <p className="text-sm text-yellow-600">
              No users with modify permission found above you in the hierarchy.
            </p>
          )}
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCaseRequestChangeModal(false);
                setSelectedApprover('');
              }}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                console.log('Submit Request button clicked in case overview modal');
                console.log('Button state - submitting:', submitting, 'selectedApprover:', selectedApprover, 'loadingApprovers:', loadingApprovers);
                handleRequestCaseChange();
              }}
              className="flex-1"
              disabled={submitting || !selectedApprover || loadingApprovers}
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Request Change Modal (for Case Overview) */}
      <Modal
        isOpen={showCaseRequestChangeModal}
        onClose={() => {
          setShowCaseRequestChangeModal(false);
          setSelectedApprover('');
        }}
        title="Request Change - Case Details"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a user with modify permission to approve your changes to case details:
          </p>
          <Select
            label="Select Approver"
            value={selectedApprover}
            onChange={(e) => setSelectedApprover(e.target.value)}
            required
            disabled={loadingApprovers}
            options={[
              { value: '', label: loadingApprovers ? 'Loading approvers...' : 'Select an approver' },
              ...availableApprovers.map(user => ({
                value: user.id,
                label: `${user.first_name} ${user.last_name} (${user.email})`
              }))
            ]}
          />
          {availableApprovers.length === 0 && !loadingApprovers && (
            <p className="text-sm text-yellow-600">
              No users with modify permission found above you in the hierarchy.
            </p>
          )}
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCaseRequestChangeModal(false);
                setSelectedApprover('');
              }}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestCaseChange}
              className="flex-1"
              disabled={submitting || !selectedApprover || loadingApprovers}
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </Modal>
                        </div>
                      );
                    }
                  })}
                </div>
                {hasMore && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="secondary"
                      onClick={() => setShowAllItems(!showAllItems)}
                      className="px-4 py-2"
                    >
                      {showAllItems ? `Show Less (Top ${itemsPerPage})` : `Show All (${totalItems} total)`}
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Change Requests Section */}
        {hasPermission('crm.case.customer_details.modify') && changeRequests.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Change Requests (Case Details & Customer Details)</h2>
              {changeRequests.filter((r: any) => r.status === 'PENDING' && r.requested_for.id === user?.id).length > 0 && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                  {changeRequests.filter((r: any) => r.status === 'PENDING' && r.requested_for.id === user?.id).length} Pending Approval
                </span>
              )}
            </div>
            <div className="space-y-4">
              {changeRequests.map((request) => (
                <div
                  key={request.id}
                  className={`p-4 rounded-lg border-2 ${
                    request.status === 'PENDING'
                      ? 'bg-yellow-50 border-yellow-300'
                      : request.status === 'APPROVED'
                      ? 'bg-green-50 border-green-300'
                      : 'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Requested by: {request.requested_by.first_name} {request.requested_by.last_name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        request.status === 'PENDING'
                          ? 'bg-yellow-200 text-yellow-800'
                          : request.status === 'APPROVED'
                          ? 'bg-green-200 text-green-800'
                          : 'bg-red-200 text-red-800'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Requested Changes:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(request.requested_changes || {}).map(([key, value]: [string, any]) => {
                        // Check if it's a case field or customer detail sheet field
                        const caseFields: Record<string, string> = {
                          customer_name: 'Customer Name',
                          customer_email: 'Customer Email',
                          customer_phone: 'Customer Phone',
                          loan_type: 'Loan Type',
                          loan_amount: 'Loan Amount',
                          source_type: 'Source Type',
                        };
                        
                        let formattedKey: string;
                        let displayValue: string = String(value || 'Not mentioned');
                        
                        if (caseFields[key]) {
                          formattedKey = caseFields[key];
                          if (key === 'loan_type') {
                            displayValue = LOAN_TYPES.find(t => t.value === value)?.label || displayValue;
                          } else if (key === 'loan_amount') {
                            displayValue = formatIndianCurrency(parseFloat(value) || 0);
                          }
                        } else {
                          const templateField = templateFields.find(f => f.field_key === key);
                          formattedKey = templateField?.field_label || key
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        }
                        
                        return (
                          <div key={key} className="p-2 bg-white rounded border border-gray-200">
                            <p className="text-xs text-gray-600">{formattedKey}</p>
                            <p className="text-sm font-medium text-gray-900">{displayValue}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {request.status === 'PENDING' && request.requested_for.id === user?.id && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const remarks = prompt('Enter approval remarks (optional):');
                          if (remarks !== null) {
                            handleApproveChangeRequest(request.id, remarks || undefined);
                          }
                        }}
                        className="flex-1 bg-green-600 text-white hover:bg-green-700"
                        disabled={submitting}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const remarks = prompt('Enter rejection reason (required):');
                          if (remarks && remarks.trim()) {
                            handleRejectChangeRequest(request.id, remarks);
                          }
                        }}
                        className="flex-1 bg-red-600 text-white hover:bg-red-700"
                        disabled={submitting}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {request.status !== 'PENDING' && request.approval_remarks && (
                    <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                      <p className="text-xs text-gray-600">Remarks:</p>
                      <p className="text-sm text-gray-900">{request.approval_remarks}</p>
                      {request.approved_by && (
                        <p className="text-xs text-gray-500 mt-1">
                          {request.status === 'APPROVED' ? 'Approved' : 'Rejected'} by{' '}
                          {request.approved_by.first_name} {request.approved_by.last_name} on{' '}
                          {new Date(request.approved_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                        {event.type === 'status_change' && (
                          <>
                            Status changed to {getStatusLabel(event.details.to_status)}
                            {event.details.remarks && (
                              <span className="block mt-1 text-sm text-gray-600 font-normal">
                                Remarks: {event.details.remarks}
                              </span>
                            )}
                          </>
                        )}
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
          <Select
            label="Select User"
            value={assignUserId}
            onChange={(e) => setAssignUserId(e.target.value)}
            required
            disabled={loadingUsers}
            options={[
              { value: '', label: loadingUsers ? 'Loading users...' : 'Select a user' },
              ...availableUsers.map(user => ({
                value: user.id,
                label: `${user.firstName} ${user.lastName} (${user.email})`
              }))
            ]}
          />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => {
              setShowAssignModal(false);
              setAssignUserId('');
            }} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleAssign} className="flex-1" disabled={submitting || !assignUserId || loadingUsers}>
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

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => {
        setShowDeleteModal(false);
        setDeleteConfirmText('');
      }} title="Delete Case">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-800 mb-2">
              Warning: This action cannot be undone!
            </p>
            <p className="text-sm text-red-700">
              You are about to permanently delete case: <span className="font-semibold">{caseData?.case_number}</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono font-semibold text-red-600">DELETE</span> to confirm:
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && deleteConfirmText === 'DELETE') {
                  handleConfirmDelete();
                }
              }}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }} 
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmDelete} 
              className="flex-1 bg-red-600 hover:bg-red-700 text-white" 
              disabled={submitting || deleteConfirmText !== 'DELETE'}
            >
              {submitting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => {
        setShowUploadModal(false);
        setSelectedFiles([]);
      }} title="Upload Documents">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Files (Multiple)</label>
            <input
              type="file"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setSelectedFiles(files);
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-600 font-medium">{selectedFiles.length} file(s) selected:</p>
                <ul className="text-xs text-gray-500 list-disc list-inside max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <li key={index}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => {
              setShowUploadModal(false);
              setSelectedFiles([]);
            }} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleUpload} className="flex-1" disabled={submitting || selectedFiles.length === 0}>
              {submitting ? `Uploading ${selectedFiles.length} file(s)...` : `Upload ${selectedFiles.length} file(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Note Modal */}
      <Modal isOpen={showNoteModal} onClose={() => {
        setShowNoteModal(false);
        setNoteFile(null);
      }} title="Add Note">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attach File (Optional)</label>
            <input
              type="file"
              onChange={(e) => setNoteFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {noteFile && (
              <p className="mt-2 text-xs text-gray-600 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                {noteFile.name}
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => {
              setShowNoteModal(false);
              setNoteFile(null);
            }} className="flex-1">
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
          setScheduleFile(null);
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attach File (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setScheduleFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {scheduleFile && (
                  <p className="mt-2 text-xs text-gray-600 flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    {scheduleFile.name}
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedScheduleUser('');
                  setScheduleMessage('');
                  setScheduleDateTime('');
                  setScheduleFile(null);
                }} className="flex-1">
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

      {/* Preview Modal */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={closePreview}>
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 truncate flex-1 mr-4">{previewDocument.fileName}</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (previewDocument && previewUrl) {
                      const a = document.createElement('a');
                      a.href = previewUrl;
                      a.download = previewDocument.fileName;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  }}
                  className="p-2"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <button
                  onClick={closePreview}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-50 flex items-center justify-center">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                  <p className="text-sm text-gray-600">Loading preview...</p>
                </div>
              ) : previewUrl ? (
                <>
                  {isImage(previewDocument.mimeType) ? (
                    <img
                      src={previewUrl}
                      alt={previewDocument.fileName}
                      className="max-w-full max-h-[calc(90vh-8rem)] object-contain rounded-lg shadow-lg"
                    />
                  ) : isPDF(previewDocument.mimeType) ? (
                    <iframe
                      src={previewUrl}
                      className="w-full h-[calc(90vh-8rem)] border border-gray-300 rounded-lg"
                      title={previewDocument.fileName}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm text-gray-600 mb-4">Preview not available for this file type</p>
                      <Button
                        onClick={() => {
                          if (previewUrl) {
                            const a = document.createElement('a');
                            a.href = previewUrl;
                            a.download = previewDocument.fileName;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download File
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-600">Failed to load preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

