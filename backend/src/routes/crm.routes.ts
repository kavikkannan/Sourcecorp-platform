import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { CRMController } from '../controllers/crm.controller';
import * as validators from '../validators/crm.validator';

const router = Router();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// All CRM routes require authentication
router.use(authenticateToken);

// ============================================
// CASE MANAGEMENT
// ============================================

// Create new case (with optional file uploads)
router.post(
  '/cases',
  requirePermission('crm.case.create'),
  upload.array('documents', 10), // Allow up to 10 files
  validate(validators.createCaseSchema),
  CRMController.createCase
);

// Get all cases (RBAC filtered)
router.get(
  '/cases',
  requirePermission('crm.case.view'),
  validate(validators.getCasesSchema),
  CRMController.getCases
);

// Get scheduleable users (hierarchy-based) - Using different path to avoid conflict with /cases/:id
router.get(
  '/scheduleable-users',
  requirePermission('crm.case.view'),
  CRMController.getScheduleableUsers
);

// Get case by ID
router.get(
  '/cases/:id',
  requirePermission('crm.case.view'),
  validate(validators.caseIdSchema),
  CRMController.getCaseById
);

// ============================================
// CASE ASSIGNMENT
// ============================================

// Assign case to user
router.post(
  '/cases/:id/assign',
  requirePermission('crm.case.assign'),
  validate(validators.assignCaseSchema),
  CRMController.assignCase
);

// ============================================
// STATUS MANAGEMENT
// ============================================

// Update case status
router.post(
  '/cases/:id/status',
  requirePermission('crm.case.update_status'),
  validate(validators.updateStatusSchema),
  CRMController.updateStatus
);

// ============================================
// DOCUMENT MANAGEMENT
// ============================================

// Upload document
router.post(
  '/cases/:id/documents',
  requirePermission('crm.case.upload_document'),
  validate(validators.uploadDocumentSchema),
  upload.single('file'),
  CRMController.uploadDocument
);

// Get all documents for a case
router.get(
  '/cases/:id/documents',
  requirePermission('crm.case.view'),
  validate(validators.caseIdSchema),
  CRMController.getDocuments
);

// Download a specific document
router.get(
  '/documents/:documentId',
  requirePermission('crm.case.view'),
  CRMController.downloadDocument
);

// ============================================
// NOTES MANAGEMENT
// ============================================

// Add note to case
router.post(
  '/cases/:id/notes',
  requirePermission('crm.case.add_note'),
  validate(validators.addNoteSchema),
  CRMController.addNote
);

// Get all notes for a case
router.get(
  '/cases/:id/notes',
  requirePermission('crm.case.view'),
  validate(validators.caseIdSchema),
  CRMController.getNotes
);

// ============================================
// TIMELINE
// ============================================

// Get case timeline
router.get(
  '/cases/:id/timeline',
  requirePermission('crm.case.view'),
  validate(validators.caseIdSchema),
  CRMController.getTimeline
);

// ============================================
// NOTIFICATIONS/SCHEDULING
// ============================================

// Schedule notification for a case
router.post(
  '/cases/:id/schedule',
  requirePermission('crm.case.add_note'),
  validate(validators.scheduleNotificationSchema),
  CRMController.scheduleNotification
);

// Get all notifications for a case
router.get(
  '/cases/:id/notifications',
  requirePermission('crm.case.view'),
  validate(validators.caseIdSchema),
  CRMController.getCaseNotifications
);

// Get all notifications for current user
router.get(
  '/notifications',
  requirePermission('crm.case.view'),
  validate(validators.getUserNotificationsSchema),
  CRMController.getUserNotifications
);

// Get unread notification count
router.get(
  '/notifications/unread-count',
  requirePermission('crm.case.view'),
  CRMController.getUnreadNotificationCount
);

// Mark notification as read/unread
router.patch(
  '/notifications/:id/read',
  requirePermission('crm.case.view'),
  validate(validators.markNotificationReadSchema),
  CRMController.markNotificationRead
);

// Mark notification as ongoing/completed
router.patch(
  '/notifications/:id/completion',
  requirePermission('crm.case.view'),
  validate(validators.markNotificationCompletionSchema),
  CRMController.markNotificationCompletion
);

export default router;


