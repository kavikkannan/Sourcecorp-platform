import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  is_active: boolean;
  image_path?: string | null;
  category: 'GENERAL' | 'BANK_UPDATES';
  created_at: Date;
  updated_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
  userPermissions?: string[];
}

// ============================================
// CRM TYPES (PHASE 2)
// ============================================

export interface Case {
  id: string;
  case_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  loan_type: string;
  loan_amount: number;
  source_type: 'DSA' | 'DST' | null;
  current_status: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reminder_date: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export const CasePriority = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type CasePriorityType = typeof CasePriority[keyof typeof CasePriority];

export interface CaseAssignment {
  id: string;
  case_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: Date;
}

export interface CaseStatusHistory {
  id: string;
  case_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  changed_at: Date;
  remarks: string | null;
}

export interface Document {
  id: string;
  case_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: Date;
}

export interface CaseNote {
  id: string;
  case_id: string;
  note: string;
  created_by: string;
  created_at: Date;
}

export interface CaseWithDetails extends Case {
  creator?: User;
  assignments?: (CaseAssignment & { assignee?: User; assigner?: User })[];
  current_assignment?: CaseAssignment & { assignee?: User };
}

export interface TimelineEvent {
  id: string;
  type: 'status_change' | 'assignment' | 'note' | 'document';
  timestamp: Date;
  user: User;
  details: any;
}

export const CaseStatus = {
  NEW: 'NEW',
  LOGIN: 'LOGIN',
  SALES_REWORK: 'SALES_REWORK',
  CREDIT_REWORK: 'CREDIT_REWORK',
  CREDIT_UNDERWRITING: 'CREDIT_UNDERWRITING',
  CREDIT_APPROVED: 'CREDIT_APPROVED',
  DISBURSED: 'DISBURSED',
  REJECTED: 'REJECTED',
  HOLD: 'HOLD',
  CUSTOMER_NOT_RESPONDING: 'CUSTOMER_NOT_RESPONDING',
  NOT_INTERESTED: 'NOT_INTERESTED',
} as const;

export type CaseStatusType = typeof CaseStatus[keyof typeof CaseStatus];

export const LoanType = {
  PERSONAL: 'PERSONAL',
  HOME: 'HOME',
  AUTO: 'AUTO',
  BUSINESS: 'BUSINESS',
  EDUCATION: 'EDUCATION',
} as const;

export type LoanTypeType = typeof LoanType[keyof typeof LoanType];

// ============================================
// NOTIFICATION TYPES
// ============================================

export enum NotificationType {
  CASE_REMINDER = 'CASE_REMINDER',
  CHANGE_REQUEST = 'CHANGE_REQUEST',
  CASE_ASSIGNMENT = 'CASE_ASSIGNMENT',
  STATUS_CHANGE = 'STATUS_CHANGE',
  SYSTEM = 'SYSTEM',
}

export interface Notification {
  id: string;
  case_id: string;
  scheduled_for: string;
  scheduled_by: string;
  message: string | null;
  scheduled_at: Date;
  status: 'PENDING' | 'SENT' | 'CANCELLED';
  is_read: boolean;
  completion_status: 'ONGOING' | 'COMPLETED';
  type: NotificationType;
  title: string | null;
  action_url: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationWithDetails extends Notification {
  case_number?: string;
  case_customer_name?: string;
  case_status?: string;
  scheduled_by_user?: User;
  document?: Document;
  change_request_id?: string;
  change_request_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  change_request_changes?: Record<string, any>;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  in_app: boolean;
  email: boolean;
  push: boolean;
  digest_mode: 'IMMEDIATE' | 'DAILY' | 'WEEKLY';
  created_at: Date;
  updated_at: Date;
}

// ============================================
// FINANCE TYPES (PHASE 3)
// ============================================

export interface EligibilityRule {
  id: string;
  loan_type: string;
  min_age: number;
  max_age: number;
  max_foir: number;
  income_multiplier: number;
  created_by: string;
  created_at: Date;
}

export interface EligibilityCalculation {
  id: string;
  case_id: string;
  monthly_income: number;
  eligible_amount: number;
  requested_amount: number;
  result: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  rule_snapshot: any;
  calculated_by: string;
  calculated_at: Date;
}

export interface ObligationSheet {
  id: string;
  case_id: string;
  template_id: string | null;
  template_snapshot?: any; // Snapshot of template at creation time
  total_obligation: number;
  net_income: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ObligationItem {
  id: string;
  obligation_sheet_id: string;
  item_data: Record<string, any>; // All fields from template stored as key-value pairs
  order_index: number;
  created_at: Date;
}

export interface CAMTemplate {
  id: string;
  loan_type: string;
  template_name: string;
  sections: string[]; // Array of section names
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CAMField {
  id: string;
  template_id: string;
  section_name: string;
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
  is_mandatory: boolean;
  is_user_addable: boolean;
  order_index: number;
  default_value?: string;
  validation_rules?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
  select_options?: string[];
  created_at: Date;
}

export interface CAMEntry {
  id: string;
  case_id: string;
  template_id: string | null;
  template_snapshot: any; // Snapshot of template at creation time
  cam_data: Record<string, any>; // Field values keyed by field_key
  user_added_fields?: Record<string, { label: string; type: string }>; // Metadata for user-added fields
  version: number;
  created_by: string;
  created_at: Date;
}

export interface ObligationTemplate {
  id: string;
  template_name: string;
  sections: string[];
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ObligationField {
  id: string;
  template_id: string;
  section_name: string;
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
  is_mandatory: boolean;
  is_repeatable: boolean;
  order_index: number;
  default_value?: string;
  validation_rules?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
  select_options?: string[];
  created_at: Date;
}

// ============================================
// HIERARCHY TYPES
// ============================================

export interface UserHierarchy {
  id: string;
  manager_id: string;
  subordinate_id: string;
  created_at: Date;
}

export interface HierarchyNode {
  user: User;
  manager?: HierarchyNode;
  subordinates: HierarchyNode[];
  depth: number;
}

export interface HierarchyTree {
  root: HierarchyNode[];
  maxDepth: number;
}

// ============================================
// TASK TYPES
// ============================================

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  task_type: 'PERSONAL' | 'COMMON' | 'HIERARCHICAL';
  direction: 'DOWNWARD' | 'UPWARD' | null;
  linked_case_id: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  due_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TaskWithUsers extends Task {
  assignee?: User;
  assigner?: User;
  linked_case?: Case;
}

export interface TaskComment {
  id: string;
  task_id: string;
  comment: string;
  created_by: string;
  created_at: Date;
  creator?: User;
}

// ============================================
// NOTE TYPES
// ============================================

export interface Note {
  id: string;
  content: string;
  created_by: string;
  linked_case_id: string | null;
  visibility: 'PRIVATE' | 'CASE';
  created_at: Date;
  creator?: User;
  linked_case?: Case;
}

// ============================================
// DAILY REPORT TYPES
// ============================================

export interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  opening_existing_callbacks: number;
  opening_existing_followups: number;
  opening_instocks_login: number;
  opening_instocks_volume: number;
  opening_instocks_approval: number;
  opening_disbursed: number;
  opening_login_commitment: number;
  opening_expected_conversion: number;
  opening_documents_pending: number;
  opening_login_pending: number;
  closing_existing_callbacks: number;
  closing_existing_followups: number;
  closing_total_logins: number;
  closing_total_login_volume: number;
  closing_total_approvals: number;
  closing_total_disbursed: number;
  closing_login_commitment: number;
  closing_todays_conversion: number;
  closing_todays_callback: number;
  closing_documents_pending: number;
  closing_login_pending: number;
  closing_day_status: 'IN_PROGRESS' | 'COMPLETED';
  created_at: Date;
  updated_at: Date;
}

export interface DailyReportWithUser extends DailyReport {
  user?: User;
}

// ============================================
// CHAT TYPES (PHASE 5)
// ============================================

export interface Channel {
  id: string;
  name: string | null;
  type: 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP' | 'DM';
  created_by: string;
  status: 'ACTIVE' | 'PENDING';
  created_at: Date;
  creator?: User;
  member_count?: number;
}

export interface ChannelCreationRequest {
  id: string;
  requested_by: string;
  channel_name: string;
  channel_type: 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP';
  target_role_id: string | null;
  target_team_id: string | null;
  requested_members: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: Date;
  reviewed_at: Date | null;
  requester?: User;
  reviewer?: User;
  target_role?: Role;
  target_team?: Team;
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  created_at: Date;
  user?: User;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  message_type: 'TEXT' | 'FILE' | 'IMAGE';
  content: string;
  created_at: Date;
  sender?: User;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: Date;
  uploader?: User;
}

