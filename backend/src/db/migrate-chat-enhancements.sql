-- Chat System Enhancements Migration
-- Adds GROUP channel type, status column, and channel creation requests

-- 1. Add status column to channels table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'chat_schema' 
    AND table_name = 'channels' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE chat_schema.channels 
    ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE' 
    CHECK (status IN ('ACTIVE', 'PENDING'));
  END IF;
END $$;

-- 2. Update channels type constraint to include GROUP and DM
ALTER TABLE chat_schema.channels 
DROP CONSTRAINT IF EXISTS channels_type_check;

ALTER TABLE chat_schema.channels 
ADD CONSTRAINT channels_type_check 
CHECK (type IN ('GLOBAL', 'ROLE', 'TEAM', 'GROUP', 'DM'));

-- 3. Make name nullable (for DM channels)
ALTER TABLE chat_schema.channels 
ALTER COLUMN name DROP NOT NULL;

-- 4. Create channel_creation_requests table
CREATE TABLE IF NOT EXISTS chat_schema.channel_creation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by UUID NOT NULL REFERENCES auth_schema.users(id),
  channel_name VARCHAR(255) NOT NULL,
  channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('GLOBAL', 'ROLE', 'TEAM', 'GROUP')),
  target_role_id UUID REFERENCES auth_schema.roles(id),
  target_team_id UUID REFERENCES auth_schema.teams(id),
  requested_members JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES auth_schema.users(id),
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_channels_status ON chat_schema.channels(status);
CREATE INDEX IF NOT EXISTS idx_channel_requests_requested_by ON chat_schema.channel_creation_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_channel_requests_status ON chat_schema.channel_creation_requests(status);
CREATE INDEX IF NOT EXISTS idx_channel_requests_reviewed_by ON chat_schema.channel_creation_requests(reviewed_by);

