import { query } from '../db/pool';
import { Note, User, Case } from '../types';
import { CRMService } from './crm.service';
import { logger } from '../config/logger';

export class NoteService {
  /**
   * Create a new note
   */
  static async createNote(
    content: string,
    createdBy: string,
    linkedCaseId: string | null,
    visibility: 'PRIVATE' | 'CASE'
  ): Promise<Note> {
    // Validate visibility rules
    if (visibility === 'CASE' && !linkedCaseId) {
      throw new Error('CASE visibility requires a linked case');
    }

    if (visibility === 'PRIVATE' && linkedCaseId) {
      throw new Error('PRIVATE notes cannot be linked to a case');
    }

    // Validate case access if linked
    if (linkedCaseId) {
      // Get user role for case access check
      const userResult = await query(
        `SELECT r.name as role_name
         FROM auth_schema.users u
         LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
         LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
         WHERE u.id = $1
         LIMIT 1`,
        [createdBy]
      );

      const userRole = userResult.rows[0]?.role_name || 'employee';

      // Check case exists
      const caseCheck = await query(
        `SELECT id FROM crm_schema.cases WHERE id = $1`,
        [linkedCaseId]
      );

      if (caseCheck.rows.length === 0) {
        throw new Error('Linked case not found');
      }

      // RBAC check for case access
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        const accessCheck = await query(
          `SELECT 1 FROM crm_schema.cases c
           LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
           WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
          [linkedCaseId, createdBy]
        );

        if (accessCheck.rows.length === 0) {
          throw new Error('Access denied to linked case');
        }
      }
    }

    // Insert the note
    const result = await query(
      `INSERT INTO note_schema.notes (content, created_by, linked_case_id, visibility)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, created_by, linked_case_id, visibility, created_at`,
      [content, createdBy, linkedCaseId, visibility]
    );

    return result.rows[0];
  }

  /**
   * Get a note by ID with user and case details
   */
  static async getNote(noteId: string, userId: string): Promise<Note | null> {
    const result = await query(
      `SELECT n.*,
              u.id as creator_id, u.email as creator_email,
              u.first_name as creator_first_name, u.last_name as creator_last_name,
              u.is_active as creator_is_active, u.created_at as creator_created_at, u.updated_at as creator_updated_at,
              c.id as case_id, c.case_number, c.customer_name, c.current_status
       FROM note_schema.notes n
       JOIN auth_schema.users u ON n.created_by = u.id
       LEFT JOIN crm_schema.cases c ON n.linked_case_id = c.id
       WHERE n.id = $1`,
      [noteId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Check access: PRIVATE notes only visible to creator
    if (row.visibility === 'PRIVATE' && row.created_by !== userId) {
      return null;
    }

    // Check case access for CASE notes
    if (row.visibility === 'CASE' && row.linked_case_id) {
      // Get user role
      const userResult = await query(
        `SELECT r.name as role_name
         FROM auth_schema.users u
         LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
         LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
         WHERE u.id = $1
         LIMIT 1`,
        [userId]
      );

      const userRole = userResult.rows[0]?.role_name || 'employee';

      if (userRole !== 'admin' && userRole !== 'super_admin') {
        const accessCheck = await query(
          `SELECT 1 FROM crm_schema.cases c
           LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
           WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
          [row.linked_case_id, userId]
        );

        if (accessCheck.rows.length === 0) {
          return null;
        }
      }
    }

    const note: Note = {
      id: row.id,
      content: row.content,
      created_by: row.created_by,
      linked_case_id: row.linked_case_id,
      visibility: row.visibility,
      created_at: row.created_at,
      creator: {
        id: row.creator_id,
        email: row.creator_email,
        first_name: row.creator_first_name,
        last_name: row.creator_last_name,
        is_active: row.creator_is_active,
        created_at: row.creator_created_at,
        updated_at: row.creator_updated_at,
      },
    };

    if (row.case_id) {
      note.linked_case = {
        id: row.case_id,
        case_number: row.case_number,
        customer_name: row.customer_name,
        customer_email: '',
        customer_phone: '',
        loan_type: '',
        loan_amount: 0,
        source_type: null,
        current_status: row.current_status,
        created_by: '',
        created_at: new Date(),
        updated_at: new Date(),
      };
    }

    return note;
  }

  /**
   * Get my notes (personal notes created by user)
   */
  static async getMyNotes(userId: string): Promise<Note[]> {
    const result = await query(
      `SELECT n.*,
              u.id as creator_id, u.email as creator_email,
              u.first_name as creator_first_name, u.last_name as creator_last_name,
              u.is_active as creator_is_active, u.created_at as creator_created_at, u.updated_at as creator_updated_at
       FROM note_schema.notes n
       JOIN auth_schema.users u ON n.created_by = u.id
       WHERE n.created_by = $1 AND n.visibility = 'PRIVATE'
       ORDER BY n.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      content: row.content,
      created_by: row.created_by,
      linked_case_id: row.linked_case_id,
      visibility: row.visibility,
      created_at: row.created_at,
      creator: {
        id: row.creator_id,
        email: row.creator_email,
        first_name: row.creator_first_name,
        last_name: row.creator_last_name,
        is_active: row.creator_is_active,
        created_at: row.creator_created_at,
        updated_at: row.creator_updated_at,
      },
    }));
  }

  /**
   * Get notes linked to a case
   */
  static async getCaseNotes(caseId: string, userId: string): Promise<Note[]> {
    // Verify user has access to the case
    const userResult = await query(
      `SELECT r.name as role_name
       FROM auth_schema.users u
       LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
       LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );

    const userRole = userResult.rows[0]?.role_name || 'employee';

    // Check case exists
    const caseCheck = await query(
      `SELECT id FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (caseCheck.rows.length === 0) {
      throw new Error('Case not found');
    }

    // RBAC check for case access
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      const accessCheck = await query(
        `SELECT 1 FROM crm_schema.cases c
         LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
         WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
        [caseId, userId]
      );

      if (accessCheck.rows.length === 0) {
        throw new Error('Access denied to case');
      }
    }

    const result = await query(
      `SELECT n.*,
              u.id as creator_id, u.email as creator_email,
              u.first_name as creator_first_name, u.last_name as creator_last_name,
              u.is_active as creator_is_active, u.created_at as creator_created_at, u.updated_at as creator_updated_at,
              c.id as case_id, c.case_number, c.customer_name, c.current_status
       FROM note_schema.notes n
       JOIN auth_schema.users u ON n.created_by = u.id
       LEFT JOIN crm_schema.cases c ON n.linked_case_id = c.id
       WHERE n.linked_case_id = $1 AND n.visibility = 'CASE'
       ORDER BY n.created_at DESC`,
      [caseId]
    );

    return result.rows.map((row) => {
      const note: Note = {
        id: row.id,
        content: row.content,
        created_by: row.created_by,
        linked_case_id: row.linked_case_id,
        visibility: row.visibility,
        created_at: row.created_at,
        creator: {
          id: row.creator_id,
          email: row.creator_email,
          first_name: row.creator_first_name,
          last_name: row.creator_last_name,
          is_active: row.creator_is_active,
          created_at: row.creator_created_at,
          updated_at: row.creator_updated_at,
        },
      };

      if (row.case_id) {
        note.linked_case = {
          id: row.case_id,
          case_number: row.case_number,
          customer_name: row.customer_name,
          customer_email: '',
          customer_phone: '',
          loan_type: '',
          loan_amount: 0,
          source_type: null,
          current_status: row.current_status,
          created_by: '',
          created_at: new Date(),
          updated_at: new Date(),
        };
      }

      return note;
    });
  }

  /**
   * Delete a note (only by creator)
   */
  static async deleteNote(noteId: string, userId: string): Promise<void> {
    const result = await query(
      `SELECT created_by FROM note_schema.notes WHERE id = $1`,
      [noteId]
    );

    if (result.rows.length === 0) {
      throw new Error('Note not found');
    }

    if (result.rows[0].created_by !== userId) {
      throw new Error('Only the note creator can delete the note');
    }

    await query(
      `DELETE FROM note_schema.notes WHERE id = $1`,
      [noteId]
    );
  }
}

