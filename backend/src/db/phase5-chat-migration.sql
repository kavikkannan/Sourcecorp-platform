-- Phase 5 Chat Migration
-- Creates chat schema and tables for internal chat & file sharing

-- Create chat schema
CREATE SCHEMA IF NOT EXISTS chat_schema;

-- Create channels table
CREATE TABLE IF NOT EXISTS chat_schema.channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('GLOBAL', 'ROLE', 'TEAM')),
  created_by UUID NOT NULL REFERENCES auth_schema.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create channel_members table
CREATE TABLE IF NOT EXISTS chat_schema.channel_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES chat_schema.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS chat_schema.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES chat_schema.channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth_schema.users(id),
  message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('TEXT', 'FILE', 'IMAGE')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create attachments table
CREATE TABLE IF NOT EXISTS chat_schema.attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES chat_schema.messages(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth_schema.users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_channels_type ON chat_schema.channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_created_by ON chat_schema.channels(created_by);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON chat_schema.channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON chat_schema.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON chat_schema.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON chat_schema.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON chat_schema.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON chat_schema.attachments(message_id);

