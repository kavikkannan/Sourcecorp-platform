import { query } from '../db/pool';
import { logger } from '../config/logger';
import { Case, CaseWithDetails, CaseAssignment, CaseStatusHistory, Document, CaseNote, TimelineEvent, User } from '../types';
import { AuditService } from './audit.service';
import { HierarchyService } from './hierarchy.service';

export class CRMService {
  
  // ============================================
  // CASE MANAGEMENT
  // ============================================
  
  static async createCase(data: {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    loan_type: string;
    loan_amount: number;
    source_type?: 'DSA' | 'DST' | null;
    created_by: string;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<Case> {
    const result = await query(
      `INSERT INTO crm_schema.cases 
       (customer_name, customer_email, customer_phone, loan_type, loan_amount, source_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.customer_name,
        data.customer_email,
        data.customer_phone,
        data.loan_type,
        data.loan_amount,
        data.source_type || null,
        data.created_by,
      ]
    );

    const newCase = result.rows[0];

    // Create initial status history
    await query(
      `INSERT INTO crm_schema.case_status_history 
       (case_id, from_status, to_status, changed_by, remarks)
       VALUES ($1, NULL, $2, $3, $4)`,
      [newCase.id, 'NEW', data.created_by, 'Case created']
    );

    // Automatically assign case to creator as initial owner
    await query(
      `INSERT INTO crm_schema.case_assignments 
       (case_id, assigned_to, assigned_by)
       VALUES ($1, $2, $2)`,
      [newCase.id, data.created_by]
    );

    // Update case status to ASSIGNED since it's now assigned to the creator
    await query(
      `UPDATE crm_schema.cases 
       SET current_status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [newCase.id]
    );

    // Create status history for assignment
    await query(
      `INSERT INTO crm_schema.case_status_history 
       (case_id, from_status, to_status, changed_by, remarks)
       VALUES ($1, $2, $3, $4, $5)`,
      [newCase.id, 'NEW', 'ASSIGNED', data.created_by, 'Case assigned to creator']
    );

    // Audit log for case creation
    await AuditService.createLog({
      userId: data.created_by,
      action: 'case.create',
      resourceType: 'case',
      resourceId: newCase.id,
      details: { case_number: newCase.case_number, loan_type: data.loan_type, loan_amount: data.loan_amount },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    // Audit log for automatic assignment
    await AuditService.createLog({
      userId: data.created_by,
      action: 'case.assign',
      resourceType: 'case',
      resourceId: newCase.id,
      details: { assigned_to: data.created_by, auto_assigned: true },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return newCase;
  }

  static async getCases(filters: {
    userId?: string;
    userRole?: string;
    userTeams?: string[];
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ cases: CaseWithDetails[], total: number }> {
    const { userId, userRole, userTeams, status, limit = 20, offset = 0 } = filters;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    // RBAC filtering
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      // Non-admins see only assigned cases or cases created by them
      // Scheduled users access cases via notifications page, not case list
      whereClause += ` AND (
        c.created_by = $${paramIndex} 
        OR EXISTS (
          SELECT 1 FROM crm_schema.case_assignments ca
          WHERE ca.case_id = c.id AND ca.assigned_to = $${paramIndex}
        )
      )`;
      params.push(userId);
      paramIndex++;
    }

    // Status filter
    if (status) {
      whereClause += ` AND c.current_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT 
        c.*,
        creator.id as creator_id,
        creator.email as creator_email,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        assignee.id as assignee_id,
        assignee.email as assignee_email,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name
       FROM crm_schema.cases c
       LEFT JOIN auth_schema.users creator ON c.created_by = creator.id
       LEFT JOIN LATERAL (
         SELECT * FROM crm_schema.case_assignments
         WHERE case_id = c.id
         ORDER BY assigned_at DESC
         LIMIT 1
       ) ca ON true
       LEFT JOIN auth_schema.users assignee ON ca.assigned_to = assignee.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(DISTINCT c.id) as total 
       FROM crm_schema.cases c
       LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
       ${whereClause}`,
      params.slice(0, -2)
    );

    const cases = result.rows.map(row => ({
      id: row.id,
      case_number: row.case_number,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      customer_phone: row.customer_phone,
      loan_type: row.loan_type,
      loan_amount: parseFloat(row.loan_amount),
      source_type: row.source_type,
      current_status: row.current_status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      creator: row.creator_id ? {
        id: row.creator_id,
        email: row.creator_email,
        first_name: row.creator_first_name,
        last_name: row.creator_last_name,
      } : undefined,
      current_assignment: row.assignee_id ? {
        id: row.assignee_id,
        assigned_to: row.assignee_id,
        assignee: {
          id: row.assignee_id,
          email: row.assignee_email,
          first_name: row.assignee_first_name,
          last_name: row.assignee_last_name,
        }
      } : undefined,
    }));

    return {
      cases,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  static async getCaseById(caseId: string, userId: string, userRole: string): Promise<CaseWithDetails | null> {
    const result = await query(
      `SELECT 
        c.*,
        creator.id as creator_id,
        creator.email as creator_email,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name
       FROM crm_schema.cases c
       LEFT JOIN auth_schema.users creator ON c.created_by = creator.id
       WHERE c.id = $1`,
      [caseId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const caseData = result.rows[0];

    // Check RBAC: non-admins can only see their own cases, assigned cases, or cases they're scheduled for
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      const accessCheck = await query(
        `SELECT 1 FROM crm_schema.cases c
         LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
         WHERE c.id = $1 AND (
           c.created_by = $2 
           OR ca.assigned_to = $2
           OR EXISTS (
             SELECT 1 FROM crm_schema.case_notifications cn
             WHERE cn.case_id = c.id AND cn.scheduled_for = $2
           )
         )`,
        [caseId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return null;
      }
    }

    // Get assignments
    const assignmentsResult = await query(
      `SELECT 
        ca.*,
        assignee.email as assignee_email,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        assigner.email as assigner_email,
        assigner.first_name as assigner_first_name,
        assigner.last_name as assigner_last_name
       FROM crm_schema.case_assignments ca
       LEFT JOIN auth_schema.users assignee ON ca.assigned_to = assignee.id
       LEFT JOIN auth_schema.users assigner ON ca.assigned_by = assigner.id
       WHERE ca.case_id = $1
       ORDER BY ca.assigned_at DESC`,
      [caseId]
    );

    const assignments = assignmentsResult.rows.map(row => ({
      id: row.id,
      case_id: row.case_id,
      assigned_to: row.assigned_to,
      assigned_by: row.assigned_by,
      assigned_at: row.assigned_at,
      assignee: {
        id: row.assigned_to,
        email: row.assignee_email,
        first_name: row.assignee_first_name,
        last_name: row.assignee_last_name,
      },
      assigner: {
        id: row.assigned_by,
        email: row.assigner_email,
        first_name: row.assigner_first_name,
        last_name: row.assigner_last_name,
      },
    }));

    return {
      id: caseData.id,
      case_number: caseData.case_number,
      customer_name: caseData.customer_name,
      customer_email: caseData.customer_email,
      customer_phone: caseData.customer_phone,
      loan_type: caseData.loan_type,
      loan_amount: parseFloat(caseData.loan_amount),
      source_type: caseData.source_type,
      current_status: caseData.current_status,
      created_by: caseData.created_by,
      created_at: caseData.created_at,
      updated_at: caseData.updated_at,
      creator: caseData.creator_id ? {
        id: caseData.creator_id,
        email: caseData.creator_email,
        first_name: caseData.creator_first_name,
        last_name: caseData.creator_last_name,
      } : undefined,
      assignments,
      current_assignment: assignments.length > 0 ? assignments[0] : undefined,
    };
  }

  // ============================================
  // CASE ASSIGNMENT
  // ============================================

  static async assignCase(data: {
    case_id: string;
    assigned_to: string;
    assigned_by: string;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<CaseAssignment> {
    const result = await query(
      `INSERT INTO crm_schema.case_assignments 
       (case_id, assigned_to, assigned_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.case_id, data.assigned_to, data.assigned_by]
    );

    // Update case status to ASSIGNED if it's NEW
    await query(
      `UPDATE crm_schema.cases 
       SET current_status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND current_status = 'NEW'`,
      [data.case_id]
    );

    // Audit log
    await AuditService.createLog({
      userId: data.assigned_by,
      action: 'case.assign',
      resourceType: 'case',
      resourceId: data.case_id,
      details: { assigned_to: data.assigned_to },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return result.rows[0];
  }

  // ============================================
  // STATUS MANAGEMENT
  // ============================================

  static async updateCaseStatus(data: {
    case_id: string;
    new_status: string;
    changed_by: string;
    remarks?: string;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<CaseStatusHistory> {
    // Get current status
    const caseResult = await query(
      `SELECT current_status FROM crm_schema.cases WHERE id = $1`,
      [data.case_id]
    );

    if (caseResult.rows.length === 0) {
      throw new Error('Case not found');
    }

    const oldStatus = caseResult.rows[0].current_status;

    // Update case status
    await query(
      `UPDATE crm_schema.cases 
       SET current_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [data.new_status, data.case_id]
    );

    // Record status change in history
    const historyResult = await query(
      `INSERT INTO crm_schema.case_status_history 
       (case_id, from_status, to_status, changed_by, remarks)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.case_id, oldStatus, data.new_status, data.changed_by, data.remarks || null]
    );

    // Audit log
    await AuditService.createLog({
      userId: data.changed_by,
      action: 'case.status_update',
      resourceType: 'case',
      resourceId: data.case_id,
      details: { from_status: oldStatus, to_status: data.new_status, remarks: data.remarks },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return historyResult.rows[0];
  }

  // ============================================
  // DOCUMENT MANAGEMENT
  // ============================================

  static async addDocument(data: {
    case_id: string;
    file_name: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    uploaded_by: string;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<Document> {
    const result = await query(
      `INSERT INTO crm_schema.documents 
       (case_id, file_name, file_path, mime_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.case_id,
        data.file_name,
        data.file_path,
        data.mime_type,
        data.file_size,
        data.uploaded_by,
      ]
    );

    // Audit log
    await AuditService.createLog({
      userId: data.uploaded_by,
      action: 'case.document_upload',
      resourceType: 'case',
      resourceId: data.case_id,
      details: { file_name: data.file_name, file_size: data.file_size },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return result.rows[0];
  }

  static async getDocuments(caseId: string): Promise<Document[]> {
    const result = await query(
      `SELECT d.*, 
        u.email as uploader_email,
        u.first_name as uploader_first_name,
        u.last_name as uploader_last_name
       FROM crm_schema.documents d
       LEFT JOIN auth_schema.users u ON d.uploaded_by = u.id
       WHERE d.case_id = $1
       ORDER BY d.uploaded_at DESC`,
      [caseId]
    );

    return result.rows;
  }

  static async getDocumentById(documentId: string): Promise<Document | null> {
    const result = await query(
      `SELECT * FROM crm_schema.documents WHERE id = $1`,
      [documentId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // ============================================
  // NOTES MANAGEMENT
  // ============================================

  static async addNote(data: {
    case_id: string;
    note: string;
    created_by: string;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<CaseNote> {
    const result = await query(
      `INSERT INTO crm_schema.case_notes 
       (case_id, note, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.case_id, data.note, data.created_by]
    );

    // Audit log
    await AuditService.createLog({
      userId: data.created_by,
      action: 'case.note_add',
      resourceType: 'case',
      resourceId: data.case_id,
      details: { note: data.note },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return result.rows[0];
  }

  static async getNotes(caseId: string): Promise<CaseNote[]> {
    const result = await query(
      `SELECT n.*, 
        u.email as creator_email,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
       FROM crm_schema.case_notes n
       LEFT JOIN auth_schema.users u ON n.created_by = u.id
       WHERE n.case_id = $1
       ORDER BY n.created_at DESC`,
      [caseId]
    );

    return result.rows;
  }

  // ============================================
  // TIMELINE
  // ============================================

  static async getTimeline(caseId: string): Promise<TimelineEvent[]> {
    // Get status history
    const statusHistory = await query(
      `SELECT 
        sh.id,
        sh.changed_at as timestamp,
        sh.from_status,
        sh.to_status,
        sh.remarks,
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        'status_change' as type
       FROM crm_schema.case_status_history sh
       LEFT JOIN auth_schema.users u ON sh.changed_by = u.id
       WHERE sh.case_id = $1`,
      [caseId]
    );

    // Get assignments
    const assignments = await query(
      `SELECT 
        ca.id,
        ca.assigned_at as timestamp,
        ca.assigned_to,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        'assignment' as type
       FROM crm_schema.case_assignments ca
       LEFT JOIN auth_schema.users u ON ca.assigned_by = u.id
       LEFT JOIN auth_schema.users assignee ON ca.assigned_to = assignee.id
       WHERE ca.case_id = $1`,
      [caseId]
    );

    // Get notes
    const notes = await query(
      `SELECT 
        n.id,
        n.created_at as timestamp,
        n.note,
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        'note' as type
       FROM crm_schema.case_notes n
       LEFT JOIN auth_schema.users u ON n.created_by = u.id
       WHERE n.case_id = $1`,
      [caseId]
    );

    // Get documents
    const documents = await query(
      `SELECT 
        d.id,
        d.uploaded_at as timestamp,
        d.file_name,
        d.file_size,
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        'document' as type
       FROM crm_schema.documents d
       LEFT JOIN auth_schema.users u ON d.uploaded_by = u.id
       WHERE d.case_id = $1`,
      [caseId]
    );

    // Get notifications
    const notifications = await query(
      `SELECT 
        n.id,
        n.created_at as timestamp,
        n.scheduled_at,
        n.message,
        n.status,
        scheduled_for_user.id as scheduled_for_user_id,
        scheduled_for_user.email as scheduled_for_email,
        scheduled_for_user.first_name as scheduled_for_first_name,
        scheduled_for_user.last_name as scheduled_for_last_name,
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        'notification' as type
       FROM crm_schema.case_notifications n
       LEFT JOIN auth_schema.users u ON n.scheduled_by = u.id
       LEFT JOIN auth_schema.users scheduled_for_user ON n.scheduled_for = scheduled_for_user.id
       WHERE n.case_id = $1`,
      [caseId]
    );

    // Combine all events
    const events: TimelineEvent[] = [
      ...statusHistory.rows.map(row => ({
        id: row.id,
        type: 'status_change' as const,
        timestamp: row.timestamp,
        user: {
          id: row.user_id,
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
        },
        details: {
          from_status: row.from_status,
          to_status: row.to_status,
          remarks: row.remarks,
        },
      })),
      ...assignments.rows.map(row => ({
        id: row.id,
        type: 'assignment' as const,
        timestamp: row.timestamp,
        user: {
          id: row.user_id,
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
        },
        details: {
          assigned_to: row.assigned_to,
          assignee_name: `${row.assignee_first_name} ${row.assignee_last_name}`,
        },
      })),
      ...notes.rows.map(row => ({
        id: row.id,
        type: 'note' as const,
        timestamp: row.timestamp,
        user: {
          id: row.user_id,
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
        },
        details: {
          note: row.note,
        },
      })),
      ...documents.rows.map(row => ({
        id: row.id,
        type: 'document' as const,
        timestamp: row.timestamp,
        user: {
          id: row.user_id,
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
        },
        details: {
          file_name: row.file_name,
          file_size: row.file_size,
        },
      })),
      ...notifications.rows.map(row => ({
        id: row.id,
        type: 'notification' as const,
        timestamp: row.timestamp,
        user: {
          id: row.user_id,
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
        },
        details: {
          scheduled_for: {
            id: row.scheduled_for_user_id,
            email: row.scheduled_for_email,
            first_name: row.scheduled_for_first_name,
            last_name: row.scheduled_for_last_name,
          },
          scheduled_at: row.scheduled_at,
          message: row.message,
          status: row.status,
        },
      })),
    ];

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events;
  }

  // ============================================
  // NOTIFICATIONS/SCHEDULING
  // ============================================

  /**
   * Get users that can be scheduled for notifications based on hierarchy
   * Returns: users above (managers) and below (subordinates) in hierarchy
   * Excludes: same level users and users from other teams
   */
  static async getScheduleableUsers(userId: string): Promise<{ above: User[]; below: User[] }> {
    // Get user's teams
    const userTeamsResult = await query(
      `SELECT team_id FROM auth_schema.team_members WHERE user_id = $1`,
      [userId]
    );
    const userTeamIds = userTeamsResult.rows.map(row => row.team_id);

    // Get all users above (managers chain)
    const aboveUsers: User[] = [];
    let currentUserId: string | null = userId;
    const visited = new Set<string>();

    while (currentUserId) {
      if (visited.has(currentUserId)) break;
      visited.add(currentUserId);

      const manager = await HierarchyService.getManager(currentUserId);
      if (!manager) break;

      // Check if manager is in same team (if user has teams)
      if (userTeamIds.length > 0) {
        const managerTeamsResult = await query(
          `SELECT team_id FROM auth_schema.team_members WHERE user_id = $1`,
          [manager.id]
        );
        const managerTeamIds = managerTeamsResult.rows.map(row => row.team_id);
        
        // Only include if manager shares at least one team with user
        const sharedTeams = userTeamIds.filter(id => managerTeamIds.includes(id));
        if (sharedTeams.length === 0 && userTeamIds.length > 0) {
          break; // Manager is in different team, stop traversing up
        }
      }

      aboveUsers.push(manager);
      currentUserId = manager.id;
    }

    // Get all users below (subordinates recursively)
    const allSubordinates = await HierarchyService.getAllSubordinates(userId);
    const belowUsers: User[] = [];

    for (const sub of allSubordinates) {
      // Check if subordinate is in same team (if user has teams)
      if (userTeamIds.length > 0) {
        const subTeamsResult = await query(
          `SELECT team_id FROM auth_schema.team_members WHERE user_id = $1`,
          [sub.id]
        );
        const subTeamIds = subTeamsResult.rows.map(row => row.team_id);
        
        // Only include if subordinate shares at least one team with user
        const sharedTeams = userTeamIds.filter(id => subTeamIds.includes(id));
        if (sharedTeams.length === 0 && userTeamIds.length > 0) {
          continue; // Subordinate is in different team, skip
        }
      }
      belowUsers.push(sub);
    }

    return { above: aboveUsers, below: belowUsers };
  }

  /**
   * Create a scheduled notification for a case
   */
  static async scheduleNotification(data: {
    case_id: string;
    scheduled_for: string;
    scheduled_by: string;
    message?: string;
    scheduled_at: Date;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<any> {
    // Validate that scheduled_for is in user's hierarchy (above or below)
    const scheduleableUsers = await this.getScheduleableUsers(data.scheduled_by);
    const allScheduleable = [...scheduleableUsers.above, ...scheduleableUsers.below];
    
    if (!allScheduleable.find(u => u.id === data.scheduled_for)) {
      throw new Error('Cannot schedule notification: User is not in your hierarchy or is in a different team');
    }

    const result = await query(
      `INSERT INTO crm_schema.case_notifications 
       (case_id, scheduled_for, scheduled_by, message, scheduled_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.case_id,
        data.scheduled_for,
        data.scheduled_by,
        data.message || null,
        data.scheduled_at,
      ]
    );

    const notification = result.rows[0];

    // Audit log
    await AuditService.createLog({
      userId: data.scheduled_by,
      action: 'case.schedule_notification',
      resourceType: 'case',
      resourceId: data.case_id,
      details: { 
        scheduled_for: data.scheduled_for, 
        scheduled_at: data.scheduled_at,
        message: data.message 
      },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return notification;
  }

  /**
   * Get all notifications for a case
   */
  static async getCaseNotifications(caseId: string): Promise<any[]> {
    const result = await query(
      `SELECT 
        n.*,
        scheduled_for_user.email as scheduled_for_email,
        scheduled_for_user.first_name as scheduled_for_first_name,
        scheduled_for_user.last_name as scheduled_for_last_name,
        scheduled_by_user.email as scheduled_by_email,
        scheduled_by_user.first_name as scheduled_by_first_name,
        scheduled_by_user.last_name as scheduled_by_last_name
       FROM crm_schema.case_notifications n
       LEFT JOIN auth_schema.users scheduled_for_user ON n.scheduled_for = scheduled_for_user.id
       LEFT JOIN auth_schema.users scheduled_by_user ON n.scheduled_by = scheduled_by_user.id
       WHERE n.case_id = $1
       ORDER BY n.scheduled_at DESC`,
      [caseId]
    );

    return result.rows.map(row => ({
      id: row.id,
      case_id: row.case_id,
      scheduled_for: {
        id: row.scheduled_for,
        email: row.scheduled_for_email,
        first_name: row.scheduled_for_first_name,
        last_name: row.scheduled_for_last_name,
      },
      scheduled_by: {
        id: row.scheduled_by,
        email: row.scheduled_by_email,
        first_name: row.scheduled_by_first_name,
        last_name: row.scheduled_by_last_name,
      },
      message: row.message,
      scheduled_at: row.scheduled_at,
      status: row.status,
      is_read: row.is_read || false,
      completion_status: row.completion_status || 'ONGOING',
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Get all notifications for a user (where they are scheduled_for)
   */
  static async getUserNotifications(userId: string, filters?: {
    is_read?: boolean;
    completion_status?: 'ONGOING' | 'COMPLETED';
    limit?: number;
    offset?: number;
  }): Promise<{ notifications: any[]; total: number }> {
    const { is_read, completion_status, limit = 50, offset = 0 } = filters || {};
    
    let whereClause = 'WHERE n.scheduled_for = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (is_read !== undefined) {
      whereClause += ` AND n.is_read = $${paramIndex}`;
      params.push(is_read);
      paramIndex++;
    }

    if (completion_status) {
      whereClause += ` AND n.completion_status = $${paramIndex}`;
      params.push(completion_status);
      paramIndex++;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT 
        n.*,
        c.case_number,
        c.customer_name,
        c.current_status as case_status,
        scheduled_by_user.email as scheduled_by_email,
        scheduled_by_user.first_name as scheduled_by_first_name,
        scheduled_by_user.last_name as scheduled_by_last_name
       FROM crm_schema.case_notifications n
       LEFT JOIN crm_schema.cases c ON n.case_id = c.id
       LEFT JOIN auth_schema.users scheduled_by_user ON n.scheduled_by = scheduled_by_user.id
       ${whereClause}
       ORDER BY n.scheduled_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) as total 
       FROM crm_schema.case_notifications n
       ${whereClause}`,
      params.slice(0, -2)
    );

    const notifications = result.rows.map(row => ({
      id: row.id,
      case_id: row.case_id,
      case_number: row.case_number,
      case_customer_name: row.customer_name,
      case_status: row.case_status,
      scheduled_by: {
        id: row.scheduled_by,
        email: row.scheduled_by_email,
        first_name: row.scheduled_by_first_name,
        last_name: row.scheduled_by_last_name,
      },
      message: row.message,
      scheduled_at: row.scheduled_at,
      status: row.status,
      is_read: row.is_read || false,
      completion_status: row.completion_status || 'ONGOING',
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return {
      notifications,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Update notification read status
   */
  static async updateNotificationReadStatus(
    notificationId: string,
    isRead: boolean,
    userId: string
  ): Promise<any> {
    // Verify user owns this notification
    const checkResult = await query(
      `SELECT id FROM crm_schema.case_notifications 
       WHERE id = $1 AND scheduled_for = $2`,
      [notificationId, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Notification not found or access denied');
    }

    const result = await query(
      `UPDATE crm_schema.case_notifications 
       SET is_read = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [isRead, notificationId]
    );

    return result.rows[0];
  }

  /**
   * Update notification completion status
   */
  static async updateNotificationCompletionStatus(
    notificationId: string,
    completionStatus: 'ONGOING' | 'COMPLETED',
    userId: string
  ): Promise<any> {
    // Verify user owns this notification
    const checkResult = await query(
      `SELECT id FROM crm_schema.case_notifications 
       WHERE id = $1 AND scheduled_for = $2`,
      [notificationId, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Notification not found or access denied');
    }

    const result = await query(
      `UPDATE crm_schema.case_notifications 
       SET completion_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [completionStatus, notificationId]
    );

    return result.rows[0];
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM crm_schema.case_notifications 
       WHERE scheduled_for = $1 AND is_read = false`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }
}


