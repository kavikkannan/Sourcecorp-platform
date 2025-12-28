import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { ChatController } from '../controllers/chat.controller';
import multer from 'multer';
import * as validators from '../validators/chat.validator';

const router = Router();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now (can be restricted later)
    cb(null, true);
  },
});

// All chat routes require authentication
router.use(authenticateToken);

// ============================================
// CHANNEL MANAGEMENT
// ============================================

// Create channel (requires permission - admin/manager only)
router.post(
  '/channels',
  requirePermission('chat.channel.create'),
  validate(validators.createChannelSchema),
  ChatController.createChannel
);

// Request channel creation (for lower hierarchy users)
router.post(
  '/channels/request',
  requirePermission('chat.channel.request'),
  validate(validators.createChannelRequestSchema),
  ChatController.createChannelRequest
);

// Approve channel request (requires permission)
router.post(
  '/channels/request/:id/approve',
  requirePermission('chat.channel.approve'),
  validate(validators.approveChannelRequestSchema),
  ChatController.approveChannelRequest
);

// Reject channel request (requires permission)
router.post(
  '/channels/request/:id/reject',
  requirePermission('chat.channel.approve'),
  validate(validators.rejectChannelRequestSchema),
  ChatController.rejectChannelRequest
);

// Get channel requests
router.get(
  '/channels/requests',
  requirePermission('chat.channel.view'),
  ChatController.getChannelRequests
);

// Start DM (auto-creates DM channel)
router.post(
  '/dm/start',
  requirePermission('chat.dm.start'),
  validate(validators.startDMSchema),
  ChatController.startDM
);

// Get all channels user can access
router.get(
  '/channels',
  requirePermission('chat.channel.view'),
  ChatController.getChannels
);

// Get specific channel
router.get(
  '/channels/:id',
  requirePermission('chat.channel.view'),
  ChatController.getChannel
);

// Get users for DM
router.get(
  '/users',
  requirePermission('chat.channel.view'),
  ChatController.getUsersForDM
);

// ============================================
// MESSAGE MANAGEMENT
// ============================================

// Send message
router.post(
  '/messages',
  requirePermission('chat.message.send'),
  validate(validators.sendMessageSchema),
  ChatController.sendMessage
);

// Get messages for a channel
router.get(
  '/messages/:channelId',
  requirePermission('chat.message.send'),
  ChatController.getMessages
);

// ============================================
// FILE MANAGEMENT
// ============================================

// Upload single file
router.post(
  '/files/upload',
  requirePermission('chat.file.upload'),
  upload.single('file'),
  ChatController.uploadFile
);

// Upload multiple files
router.post(
  '/files/upload-multiple',
  requirePermission('chat.file.upload'),
  upload.array('files', 10), // Allow up to 10 files
  ChatController.uploadMultipleFiles
);

// Download file
router.get(
  '/files/:fileId',
  requirePermission('chat.message.send'), // Users who can view messages can download files
  ChatController.downloadFile
);

export default router;

