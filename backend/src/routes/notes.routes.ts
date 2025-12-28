import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { NoteController } from '../controllers/note.controller';
import * as validators from '../validators/admin.validator';

const router = Router();

// All note routes require authentication
router.use(authenticateToken);

// ============================================
// NOTE MANAGEMENT
// ============================================

// Create note
router.post(
  '/',
  requirePermission('note.create'),
  validate(validators.createNoteSchema),
  NoteController.createNote
);

// Get my personal notes
router.get(
  '/my',
  NoteController.getMyNotes
);

// Get notes for a case
router.get(
  '/case/:caseId',
  requirePermission('note.view.case'),
  validate(validators.caseIdSchema),
  NoteController.getCaseNotes
);

// Get note by ID
router.get(
  '/:id',
  validate(validators.noteIdSchema),
  NoteController.getNote
);

// Delete note
router.delete(
  '/:id',
  validate(validators.noteIdSchema),
  NoteController.deleteNote
);

export default router;

