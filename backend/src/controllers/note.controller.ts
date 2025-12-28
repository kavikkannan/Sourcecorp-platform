import { Response } from 'express';
import { AuthRequest } from '../types';
import { NoteService } from '../services/note.service';
import { AuditService } from '../services/audit.service';

export class NoteController {
  /**
   * POST /api/notes
   * Create a new note
   */
  static async createNote(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { content, linkedCaseId, visibility } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const note = await NoteService.createNote(
        content,
        req.user.userId,
        linkedCaseId || null,
        visibility || 'PRIVATE'
      );

      // Audit log
      await AuditService.createLog({
        userId: req.user.userId,
        action: 'note.create',
        resourceType: 'note',
        resourceId: note.id,
        details: {
          visibility,
          linkedCaseId,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(note);
    } catch (error: any) {
      if (
        error.message.includes('CASE visibility requires') ||
        error.message.includes('PRIVATE notes cannot be linked') ||
        error.message.includes('Access denied') ||
        error.message.includes('not found')
      ) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * GET /api/notes/my
   * Get my personal notes
   */
  static async getMyNotes(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const notes = await NoteService.getMyNotes(req.user.userId);

      res.json(notes);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/notes/case/:caseId
   * Get notes linked to a case
   */
  static async getCaseNotes(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { caseId } = req.params;
      const notes = await NoteService.getCaseNotes(caseId, req.user.userId);

      res.json(notes);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * GET /api/notes/:id
   * Get a note by ID
   */
  static async getNote(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const note = await NoteService.getNote(id, req.user.userId);

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      res.json(note);
    } catch (error) {
      throw error;
    }
  }

  /**
   * DELETE /api/notes/:id
   * Delete a note
   */
  static async deleteNote(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;

      await NoteService.deleteNote(id, req.user.userId);

      // Audit log
      await AuditService.createLog({
        userId: req.user.userId,
        action: 'note.delete',
        resourceType: 'note',
        resourceId: id,
        details: {},
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Note deleted successfully' });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Only the note creator')) {
        return res.status(403).json({ error: error.message });
      }
      throw error;
    }
  }
}

