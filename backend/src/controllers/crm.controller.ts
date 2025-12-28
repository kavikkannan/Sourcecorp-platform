import { Response } from 'express';
import { AuthRequest } from '../types';
import { CRMService } from '../services/crm.service';
import { query } from '../db/pool';
import fs from 'fs/promises';
import path from 'path';

export class CRMController {
  
  // ============================================
  // CASE MANAGEMENT
  // ============================================
  
  static async createCase(req: AuthRequest, res: Response) {
    try {
      const { customer_name, customer_email, customer_phone, loan_type, loan_amount, source_type } = req.body;
      const files = (req.files as Express.Multer.File[]) || [];
      
      // Handle source_type: convert empty string to null
      const normalizedSourceType = source_type && source_type.trim() !== '' ? source_type : null;

      const newCase = await CRMService.createCase(
        {
          customer_name,
          customer_email,
          customer_phone,
          loan_type,
          loan_amount: parseFloat(loan_amount),
          source_type: normalizedSourceType,
          created_by: req.user!.userId,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      // Upload documents if any files were provided
      const uploadedDocuments = [];
      if (files && files.length > 0) {
        const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
        await fs.mkdir(uploadDir, { recursive: true });

        for (const file of files) {
          const timestamp = Date.now();
          const filename = `${timestamp}-${file.originalname}`;
          const filepath = path.join(uploadDir, filename);

          await fs.writeFile(filepath, file.buffer);

          const document = await CRMService.addDocument(
            {
              case_id: newCase.id,
              file_name: file.originalname,
              file_path: filepath,
              mime_type: file.mimetype,
              file_size: file.size,
              uploaded_by: req.user!.userId,
            },
            {
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            }
          );

          uploadedDocuments.push({
            id: document.id,
            file_name: document.file_name,
            mime_type: document.mime_type,
            file_size: document.file_size,
            uploaded_at: document.uploaded_at,
          });
        }
      }

      res.status(201).json({
        id: newCase.id,
        case_number: newCase.case_number,
        customer_name: newCase.customer_name,
        customer_email: newCase.customer_email,
        customer_phone: newCase.customer_phone,
        loan_type: newCase.loan_type,
        loan_amount: parseFloat(newCase.loan_amount.toString()),
        source_type: newCase.source_type,
        current_status: newCase.current_status,
        created_at: newCase.created_at,
        updated_at: newCase.updated_at,
        documents: uploadedDocuments,
      });
    } catch (error) {
      throw error;
    }
  }

  static async getCases(req: AuthRequest, res: Response) {
    try {
      const { status, limit = '20', offset = '0' } = req.query;

      // Get user's role to apply RBAC
      const userResult = await query(
        `SELECT r.name as role_name
         FROM auth_schema.users u
         LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
         LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
         WHERE u.id = $1`,
        [req.user!.userId]
      );

      const userRole = userResult.rows[0]?.role_name || 'employee';

      // Get user's teams
      const teamsResult = await query(
        `SELECT team_id FROM auth_schema.team_members WHERE user_id = $1`,
        [req.user!.userId]
      );

      const userTeams = teamsResult.rows.map(row => row.team_id);

      const { cases, total } = await CRMService.getCases({
        userId: req.user!.userId,
        userRole,
        userTeams,
        status: status as string | undefined,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });

      res.json({
        cases: cases.map(c => ({
          id: c.id,
          case_number: c.case_number,
          customer_name: c.customer_name,
        customer_email: c.customer_email,
        customer_phone: c.customer_phone,
        loan_type: c.loan_type,
        loan_amount: c.loan_amount,
        source_type: c.source_type,
        current_status: c.current_status,
        created_at: c.created_at,
        updated_at: c.updated_at,
          creator: c.creator ? {
            id: c.creator.id,
            email: c.creator.email,
            name: `${c.creator.first_name} ${c.creator.last_name}`,
          } : undefined,
          current_assignee: c.current_assignment?.assignee ? {
            id: c.current_assignment.assignee.id,
            email: c.current_assignment.assignee.email,
            name: `${c.current_assignment.assignee.first_name} ${c.current_assignment.assignee.last_name}`,
          } : undefined,
        })),
        total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });
    } catch (error) {
      throw error;
    }
  }

  static async getCaseById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Get user's role to apply RBAC
      const userResult = await query(
        `SELECT r.name as role_name
         FROM auth_schema.users u
         LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
         LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
         WHERE u.id = $1`,
        [req.user!.userId]
      );

      const userRole = userResult.rows[0]?.role_name || 'employee';

      const caseData = await CRMService.getCaseById(id, req.user!.userId, userRole);

      if (!caseData) {
        return res.status(404).json({ error: 'Case not found or access denied' });
      }

      res.json({
        id: caseData.id,
        case_number: caseData.case_number,
        customer_name: caseData.customer_name,
        customer_email: caseData.customer_email,
        customer_phone: caseData.customer_phone,
        loan_type: caseData.loan_type,
        loan_amount: caseData.loan_amount,
        source_type: caseData.source_type,
        current_status: caseData.current_status,
        created_at: caseData.created_at,
        updated_at: caseData.updated_at,
        creator: caseData.creator ? {
          id: caseData.creator.id,
          email: caseData.creator.email,
          name: `${caseData.creator.first_name} ${caseData.creator.last_name}`,
        } : undefined,
        assignments: caseData.assignments?.map(a => ({
          id: a.id,
          assigned_at: a.assigned_at,
          assignee: {
            id: a.assignee.id,
            email: a.assignee.email,
            name: `${a.assignee.first_name} ${a.assignee.last_name}`,
          },
          assigner: {
            id: a.assigner.id,
            email: a.assigner.email,
            name: `${a.assigner.first_name} ${a.assigner.last_name}`,
          },
        })),
      });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // ASSIGNMENT
  // ============================================

  static async assignCase(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { assigned_to } = req.body;

      // Verify the user being assigned exists
      const userCheck = await query(
        `SELECT id FROM auth_schema.users WHERE id = $1 AND is_active = true`,
        [assigned_to]
      );

      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid user or user is inactive' });
      }

      const assignment = await CRMService.assignCase(
        {
          case_id: id,
          assigned_to,
          assigned_by: req.user!.userId,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json({
        id: assignment.id,
        case_id: assignment.case_id,
        assigned_to: assignment.assigned_to,
        assigned_at: assignment.assigned_at,
      });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // STATUS MANAGEMENT
  // ============================================

  static async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { new_status, remarks } = req.body;

      const statusHistory = await CRMService.updateCaseStatus(
        {
          case_id: id,
          new_status,
          changed_by: req.user!.userId,
          remarks,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.json({
        id: statusHistory.id,
        from_status: statusHistory.from_status,
        to_status: statusHistory.to_status,
        changed_at: statusHistory.changed_at,
        remarks: statusHistory.remarks,
      });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // DOCUMENTS
  // ============================================

  static async uploadDocument(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Ensure upload directory exists
      const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
      await fs.mkdir(uploadDir, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${req.file.originalname}`;
      const filepath = path.join(uploadDir, filename);

      // Save file
      await fs.writeFile(filepath, req.file.buffer);

      const document = await CRMService.addDocument(
        {
          case_id: id,
          file_name: req.file.originalname,
          file_path: filepath,
          mime_type: req.file.mimetype,
          file_size: req.file.size,
          uploaded_by: req.user!.userId,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json({
        id: document.id,
        file_name: document.file_name,
        mime_type: document.mime_type,
        file_size: document.file_size,
        uploaded_at: document.uploaded_at,
      });
    } catch (error) {
      throw error;
    }
  }

  static async getDocuments(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const documents = await CRMService.getDocuments(id);

      res.json({
        documents: documents.map(d => ({
          id: d.id,
          file_name: d.file_name,
          mime_type: d.mime_type,
          file_size: d.file_size,
          uploaded_at: d.uploaded_at,
          uploader: d.uploader_email ? {
            email: d.uploader_email,
            name: `${d.uploader_first_name} ${d.uploader_last_name}`,
          } : undefined,
        })),
      });
    } catch (error) {
      throw error;
    }
  }

  static async downloadDocument(req: AuthRequest, res: Response) {
    try {
      const { documentId } = req.params;

      const document = await CRMService.getDocumentById(documentId);

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Verify user has access to the case
      const userResult = await query(
        `SELECT r.name as role_name
         FROM auth_schema.users u
         LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
         LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
         WHERE u.id = $1`,
        [req.user!.userId]
      );

      const userRole = userResult.rows[0]?.role_name || 'employee';

      const caseAccess = await CRMService.getCaseById(document.case_id, req.user!.userId, userRole);

      if (!caseAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Read and send file
      const fileBuffer = await fs.readFile(document.file_path);
      
      res.setHeader('Content-Type', document.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${document.file_name}"`);
      res.send(fileBuffer);
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // NOTES
  // ============================================

  static async addNote(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { note } = req.body;

      const newNote = await CRMService.addNote(
        {
          case_id: id,
          note,
          created_by: req.user!.userId,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json({
        id: newNote.id,
        note: newNote.note,
        created_at: newNote.created_at,
      });
    } catch (error) {
      throw error;
    }
  }

  static async getNotes(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const notes = await CRMService.getNotes(id);

      res.json({
        notes: notes.map(n => ({
          id: n.id,
          note: n.note,
          created_at: n.created_at,
          creator: n.creator_email ? {
            email: n.creator_email,
            name: `${n.creator_first_name} ${n.creator_last_name}`,
          } : undefined,
        })),
      });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // TIMELINE
  // ============================================

  static async getTimeline(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const timeline = await CRMService.getTimeline(id);

      res.json({
        timeline: timeline.map(event => ({
          id: event.id,
          type: event.type,
          timestamp: event.timestamp,
          user: {
            id: event.user.id,
            email: event.user.email,
            name: `${event.user.first_name} ${event.user.last_name}`,
          },
          details: event.details,
        })),
      });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // NOTIFICATIONS/SCHEDULING
  // ============================================

  static async getScheduleableUsers(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const users = await CRMService.getScheduleableUsers(req.user.userId);

      res.json({
        above: users.above.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.first_name,
          lastName: u.last_name,
        })),
        below: users.below.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.first_name,
          lastName: u.last_name,
        })),
      });
    } catch (error: any) {
      console.error('Error in getScheduleableUsers:', error);
      return res.status(500).json({ error: error.message || 'Failed to get scheduleable users' });
    }
  }

  static async scheduleNotification(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { scheduled_for, message, scheduled_at } = req.body;

      if (!scheduled_for || !scheduled_at) {
        return res.status(400).json({ error: 'scheduled_for and scheduled_at are required' });
      }

      const notification = await CRMService.scheduleNotification(
        {
          case_id: id,
          scheduled_for,
          scheduled_by: req.user!.userId,
          message,
          scheduled_at: new Date(scheduled_at),
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json({
        id: notification.id,
        case_id: notification.case_id,
        scheduled_for: notification.scheduled_for,
        scheduled_at: notification.scheduled_at,
        message: notification.message,
        status: notification.status,
      });
    } catch (error: any) {
      if (error.message?.includes('Cannot schedule notification')) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  }

  static async getCaseNotifications(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const notifications = await CRMService.getCaseNotifications(id);

      res.json({ notifications });
    } catch (error) {
      throw error;
    }
  }

  static async getUserNotifications(req: AuthRequest, res: Response) {
    try {
      const { is_read, completion_status, limit = '50', offset = '0' } = req.query;

      const result = await CRMService.getUserNotifications(req.user!.userId, {
        is_read: is_read === 'true' ? true : is_read === 'false' ? false : undefined,
        completion_status: completion_status as 'ONGOING' | 'COMPLETED' | undefined,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });

      res.json(result);
    } catch (error) {
      throw error;
    }
  }

  static async getUnreadNotificationCount(req: AuthRequest, res: Response) {
    try {
      const count = await CRMService.getUnreadNotificationCount(req.user!.userId);
      res.json({ count });
    } catch (error) {
      throw error;
    }
  }

  static async markNotificationRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { is_read } = req.body;

      const notification = await CRMService.updateNotificationReadStatus(
        id,
        is_read === true,
        req.user!.userId
      );

      res.json({
        id: notification.id,
        is_read: notification.is_read,
      });
    } catch (error: any) {
      if (error.message?.includes('Notification not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  static async markNotificationCompletion(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { completion_status } = req.body;

      if (!['ONGOING', 'COMPLETED'].includes(completion_status)) {
        return res.status(400).json({ error: 'Invalid completion_status. Must be ONGOING or COMPLETED' });
      }

      const notification = await CRMService.updateNotificationCompletionStatus(
        id,
        completion_status,
        req.user!.userId
      );

      res.json({
        id: notification.id,
        completion_status: notification.completion_status,
      });
    } catch (error: any) {
      if (error.message?.includes('Notification not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }
}


