import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { UsersController } from '../controllers/users.controller';
import { RolesController } from '../controllers/roles.controller';
import { PermissionsController } from '../controllers/permissions.controller';
import { TeamsController } from '../controllers/teams.controller';
import { AnnouncementsController } from '../controllers/announcements.controller';
import { AuditController } from '../controllers/audit.controller';
import { HierarchyController } from '../controllers/hierarchy.controller';
import { CRMController } from '../controllers/crm.controller';
import * as validators from '../validators/admin.validator';

const router = Router();

// Configure multer for announcement image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// All admin routes require authentication
router.use(authenticateToken);

// ============================================
// USER MANAGEMENT
// ============================================
router.post(
  '/users',
  requirePermission('admin.users.create'),
  validate(validators.createUserSchema),
  UsersController.createUser
);

router.get(
  '/users',
  requirePermission('admin.users.read'),
  UsersController.getUsers
);

router.get(
  '/users/:id',
  requirePermission('admin.users.read'),
  validate(validators.userIdSchema),
  UsersController.getUser
);

router.patch(
  '/users/:id',
  requirePermission('admin.users.update'),
  validate(validators.updateUserSchema),
  UsersController.updateUser
);

router.delete(
  '/users/:id',
  requirePermission('admin.users.delete'),
  validate(validators.userIdSchema),
  UsersController.deleteUser
);

router.post(
  '/users/:userId/roles',
  requirePermission('admin.users.assign_role'),
  validate(validators.assignRoleToUserSchema),
  UsersController.assignRole
);

router.delete(
  '/users/:userId/roles/:roleId',
  requirePermission('admin.users.remove_role'),
  validate(validators.removeRoleFromUserSchema),
  UsersController.removeRole
);

// ============================================
// ROLE MANAGEMENT
// ============================================
router.post(
  '/roles',
  requirePermission('admin.roles.create'),
  validate(validators.createRoleSchema),
  RolesController.createRole
);

router.get(
  '/roles',
  requirePermission('admin.roles.read'),
  RolesController.getRoles
);

router.get(
  '/roles/:id',
  requirePermission('admin.roles.read'),
  validate(validators.roleIdSchema),
  RolesController.getRole
);

router.patch(
  '/roles/:id',
  requirePermission('admin.roles.update'),
  validate(validators.updateRoleSchema),
  RolesController.updateRole
);

router.delete(
  '/roles/:id',
  requirePermission('admin.roles.delete'),
  validate(validators.roleIdSchema),
  RolesController.deleteRole
);

router.post(
  '/roles/:roleId/permissions',
  requirePermission('admin.roles.assign_permission'),
  validate(validators.assignPermissionToRoleSchema),
  RolesController.assignPermission
);

router.delete(
  '/roles/:roleId/permissions/:permissionId',
  requirePermission('admin.roles.remove_permission'),
  validate(validators.removePermissionFromRoleSchema),
  RolesController.removePermission
);

// ============================================
// PERMISSION MANAGEMENT
// ============================================
router.post(
  '/permissions',
  requirePermission('admin.permissions.create'),
  validate(validators.createPermissionSchema),
  PermissionsController.createPermission
);

router.get(
  '/permissions',
  requirePermission('admin.permissions.read'),
  PermissionsController.getPermissions
);

router.get(
  '/permissions/:id',
  requirePermission('admin.permissions.read'),
  validate(validators.permissionIdSchema),
  PermissionsController.getPermission
);

router.patch(
  '/permissions/:id',
  requirePermission('admin.permissions.update'),
  validate(validators.updatePermissionSchema),
  PermissionsController.updatePermission
);

router.delete(
  '/permissions/:id',
  requirePermission('admin.permissions.delete'),
  validate(validators.permissionIdSchema),
  PermissionsController.deletePermission
);

// ============================================
// TEAM MANAGEMENT
// ============================================
router.post(
  '/teams',
  requirePermission('admin.teams.create'),
  validate(validators.createTeamSchema),
  TeamsController.createTeam
);

router.get(
  '/teams',
  requirePermission('admin.teams.read'),
  TeamsController.getTeams
);

router.get(
  '/teams/:id',
  requirePermission('admin.teams.read'),
  validate(validators.teamIdSchema),
  TeamsController.getTeam
);

router.patch(
  '/teams/:id',
  requirePermission('admin.teams.update'),
  validate(validators.updateTeamSchema),
  TeamsController.updateTeam
);

router.delete(
  '/teams/:id',
  requirePermission('admin.teams.delete'),
  validate(validators.teamIdSchema),
  TeamsController.deleteTeam
);

router.post(
  '/teams/:teamId/members',
  requirePermission('admin.teams.add_member'),
  validate(validators.addTeamMemberSchema),
  TeamsController.addMember
);

router.delete(
  '/teams/:teamId/members/:userId',
  requirePermission('admin.teams.remove_member'),
  validate(validators.removeTeamMemberSchema),
  TeamsController.removeMember
);

// ============================================
// ANNOUNCEMENT MANAGEMENT
// ============================================
router.post(
  '/announcements',
  requirePermission('admin.announcements.create'),
  upload.single('image'),
  validate(validators.createAnnouncementSchema),
  AnnouncementsController.createAnnouncement
);

router.get(
  '/announcements',
  requirePermission('admin.announcements.read'),
  AnnouncementsController.getAnnouncements
);

router.get(
  '/announcements/:id',
  requirePermission('admin.announcements.read'),
  validate(validators.announcementIdSchema),
  AnnouncementsController.getAnnouncement
);

router.patch(
  '/announcements/:id',
  requirePermission('admin.announcements.update'),
  upload.single('image'),
  validate(validators.updateAnnouncementSchema),
  AnnouncementsController.updateAnnouncement
);

router.delete(
  '/announcements/:id',
  requirePermission('admin.announcements.delete'),
  validate(validators.announcementIdSchema),
  AnnouncementsController.deleteAnnouncement
);

// Serve announcement images
router.get(
  '/announcements/:id/image',
  authenticateToken,
  AnnouncementsController.getAnnouncementImage
);

// ============================================
// AUDIT LOGS (READ-ONLY)
// ============================================
router.get(
  '/audit-logs',
  requirePermission('admin.audit.read'),
  AuditController.getAuditLogs
);

// ============================================
// HIERARCHY MANAGEMENT
// ============================================
router.post(
  '/hierarchy/assign',
  requirePermission('admin.hierarchy.manage'),
  validate(validators.assignManagerSchema),
  HierarchyController.assignManager
);

router.delete(
  '/hierarchy/remove',
  requirePermission('admin.hierarchy.manage'),
  validate(validators.removeManagerSchema),
  HierarchyController.removeManager
);

router.get(
  '/hierarchy/tree',
  requirePermission('admin.hierarchy.manage'),
  HierarchyController.getHierarchyTree
);

// ============================================
// CUSTOMER DETAIL TEMPLATE MANAGEMENT
// ============================================
router.get(
  '/customer-detail-template',
  requirePermission('admin.users.read'),
  CRMController.getCustomerDetailTemplate
);

router.post(
  '/customer-detail-template',
  requirePermission('admin.users.update'),
  CRMController.updateCustomerDetailTemplate
);

export default router;

