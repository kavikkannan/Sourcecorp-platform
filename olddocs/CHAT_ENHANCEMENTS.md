# Chat System Enhancements

## Overview

Enhanced the internal chat system to support General, Role-based, Team-based, Direct, and Hierarchical Group chats with strict hierarchy-controlled creation and approval flow.

## New Features

### Channel Types

1. **GLOBAL** - All users can access
   - Creation: Admin or top hierarchy only
   - Membership: Auto-assigned to all active users

2. **ROLE** - Users with specific role
   - Creation: Admin or top hierarchy only
   - Membership: Auto-assigned based on role

3. **TEAM** - Users in specific team
   - Creation: Admin or manager only
   - Membership: Auto-assigned based on team

4. **GROUP** - Explicit members only (NEW)
   - Creation: Hierarchy-controlled approval required
   - Membership: Explicit members only
   - Lower hierarchy users must request, managers/admins approve

5. **DM** - Direct messages between two users
   - Creation: Auto-created on first message
   - Membership: Exactly two users
   - No channel name (name is null)

### Channel Status

- **ACTIVE** - Channel is active and accessible
- **PENDING** - Channel creation request is pending approval

## Database Changes

### New Migration: `migrate-chat-enhancements.ts`

1. Added `status` column to `channels` table (ACTIVE | PENDING)
2. Updated channel type constraint to include GROUP and DM
3. Made `name` nullable (for DM channels)
4. Created `channel_creation_requests` table with fields:
   - `id`, `requested_by`, `channel_name`, `channel_type`
   - `target_role_id`, `target_team_id` (nullable)
   - `requested_members` (JSONB array)
   - `status` (PENDING | APPROVED | REJECTED)
   - `reviewed_by`, `review_notes`, `reviewed_at`

### New Permissions Migration: `migrate-chat-permissions.ts`

1. `chat.channel.request` - Request channel creation (all users)
2. `chat.channel.approve` - Approve/reject requests (managers/admins)
3. `chat.dm.start` - Start direct messages (all users)

## API Endpoints

### Existing (Updated)
- `POST /api/chat/channels` - Create channel (admin/manager only, now supports GROUP)
- `GET /api/chat/channels` - Get user's channels (includes GROUP, filters by ACTIVE status)

### New Endpoints
- `POST /api/chat/channels/request` - Request channel creation (lower hierarchy)
- `POST /api/chat/channels/request/:id/approve` - Approve request (manager/admin)
- `POST /api/chat/channels/request/:id/reject` - Reject request (manager/admin)
- `GET /api/chat/channels/requests` - Get channel requests (filtered by user/status)
- `POST /api/chat/dm/start` - Start/auto-create DM channel

## Hierarchy Rules

### Channel Creation Permissions

1. **GLOBAL channels**
   - Can create: Admin, Top hierarchy (no manager)
   - Must request: Everyone else

2. **ROLE channels**
   - Can create: Admin, Top hierarchy
   - Must request: Everyone else

3. **TEAM channels**
   - Can create: Admin, Managers (users with subordinates)
   - Must request: Everyone else

4. **GROUP channels**
   - Can create directly: Admin, Managers (when approving requests)
   - Must request: Everyone else

5. **DM channels**
   - Auto-created: All users (on first message)

## Request Flow

1. **User requests channel creation**
   - POST `/api/chat/channels/request`
   - Request stored with status PENDING
   - Audit log created

2. **Manager/Admin reviews request**
   - GET `/api/chat/channels/requests` (filter by status=PENDING)
   - POST `/api/chat/channels/request/:id/approve` or `/reject`

3. **On approval**
   - Channel created with status ACTIVE
   - Members auto-added based on type
   - Request status updated to APPROVED
   - Audit log created

4. **On rejection**
   - Request status updated to REJECTED
   - Review notes required
   - Audit log created

## Implementation Details

### Service Layer (`ChatService`)

- Added hierarchy validation helpers:
  - `isAdmin(userId)` - Check if user has admin role
  - `isTopHierarchy(userId)` - Check if user has no manager
  - `isManager(userId)` - Check if user has subordinates
  - `canCreateChannelType(userId, type)` - Check creation permission

- Updated `createChannel()` to:
  - Support GROUP channel type
  - Handle status (ACTIVE/PENDING)
  - Auto-add members for ROLE/TEAM/GROUP channels
  - Validate hierarchy before creation

- Updated `getChannelsForUser()` to:
  - Include GROUP channels
  - Filter by ACTIVE status only
  - Support GROUP channel access check

- New methods:
  - `createChannelRequest()` - Create channel request
  - `approveChannelRequest()` - Approve and create channel
  - `rejectChannelRequest()` - Reject request
  - `getChannelRequests()` - List requests with filters

### Controller Layer (`ChatController`)

- Updated `createChannel()` to handle new channel types
- New methods:
  - `createChannelRequest()` - Handle request creation
  - `approveChannelRequest()` - Handle approval
  - `rejectChannelRequest()` - Handle rejection
  - `getChannelRequests()` - List requests
  - `startDM()` - Auto-create DM channels

### Routes (`chat.routes.ts`)

- Added new routes with proper permission middleware
- All routes require authentication
- Permission-based access control enforced

### Validators (`chat.validator.ts`)

- Updated `createChannelSchema` for new fields
- New schemas:
  - `createChannelRequestSchema`
  - `approveChannelRequestSchema`
  - `rejectChannelRequestSchema`
  - `startDMSchema`

## Type Definitions

### Updated Types (`types/index.ts`)

- `Channel` interface:
  - Added `GROUP` to type union
  - `name` is now nullable (for DM)
  - Added `status` field

- New interface:
  - `ChannelCreationRequest` - Full request structure with relations

## Security & Audit

- All channel creation actions are audited
- Request creation, approval, and rejection are audited
- Hierarchy validation enforced at service layer
- RBAC permissions enforced at route level
- No public channel exposure (all channels are internal)

## Migration Instructions

1. Run database migration:
   ```bash
   npm run migrate:chat-enhancements
   ```

2. Run permissions migration:
   ```bash
   npm run migrate:chat-permissions
   ```

3. Rebuild TypeScript:
   ```bash
   npm run build
   ```

4. Restart backend server

## Testing Checklist

- [ ] Admins can create GLOBAL, ROLE, TEAM channels directly
- [ ] Managers can create TEAM channels directly
- [ ] Executives can only request GROUP channel creation
- [ ] Requests require approval before activation
- [ ] Direct messages are auto-created without channel names
- [ ] Hierarchy is enforced at backend
- [ ] Audit logs created for all actions
- [ ] GROUP channels only visible to members
- [ ] Only ACTIVE channels appear in channel list
- [ ] DM channels have null names

## Notes

- DM channels are created without names (name = null)
- GROUP channels require explicit member list
- All channels must be ACTIVE to be accessible
- Lower hierarchy users cannot bypass approval by calling create directly
- Request flow is mandatory for users without direct creation permission

