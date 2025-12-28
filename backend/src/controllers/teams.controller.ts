import { Response } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { AuditService } from '../services/audit.service';

export class TeamsController {
  static async createTeam(req: AuthRequest, res: Response) {
    try {
      const { name, description } = req.body;

      const result = await query(
        `INSERT INTO auth_schema.teams (name, description)
         VALUES ($1, $2)
         RETURNING id, name, description, created_at`,
        [name, description || null]
      );

      const team = result.rows[0];

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.teams.create',
        resourceType: 'team',
        resourceId: team.id,
        details: { name, description },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(team);
    } catch (error) {
      throw error;
    }
  }

  static async getTeams(req: AuthRequest, res: Response) {
    try {
      const result = await query(
        `SELECT t.id, t.name, t.description, t.created_at,
                COUNT(DISTINCT tm.user_id) as member_count
         FROM auth_schema.teams t
         LEFT JOIN auth_schema.team_members tm ON t.id = tm.team_id
         GROUP BY t.id
         ORDER BY t.created_at DESC`
      );

      res.json(result.rows);
    } catch (error) {
      throw error;
    }
  }

  static async getTeam(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT t.id, t.name, t.description, t.created_at,
                array_agg(DISTINCT jsonb_build_object(
                  'id', u.id, 
                  'email', u.email, 
                  'firstName', u.first_name, 
                  'lastName', u.last_name
                )) FILTER (WHERE u.id IS NOT NULL) as members
         FROM auth_schema.teams t
         LEFT JOIN auth_schema.team_members tm ON t.id = tm.team_id
         LEFT JOIN auth_schema.users u ON tm.user_id = u.id
         WHERE t.id = $1
         GROUP BY t.id`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }

      const team = result.rows[0];
      team.members = team.members || [];

      res.json(team);
    } catch (error) {
      throw error;
    }
  }

  static async updateTeam(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await query(
        `UPDATE auth_schema.teams
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, description, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.teams.update',
        resourceType: 'team',
        resourceId: id,
        details: { name, description },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  static async deleteTeam(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `DELETE FROM auth_schema.teams WHERE id = $1 RETURNING id, name`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.teams.delete',
        resourceType: 'team',
        resourceId: id,
        details: { name: result.rows[0].name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Team deleted successfully' });
    } catch (error) {
      throw error;
    }
  }

  static async addMember(req: AuthRequest, res: Response) {
    try {
      const { teamId } = req.params;
      const { userId } = req.body;

      await query(
        `INSERT INTO auth_schema.team_members (team_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [teamId, userId]
      );

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.teams.add_member',
        resourceType: 'team',
        resourceId: teamId,
        details: { userId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Member added successfully' });
    } catch (error) {
      throw error;
    }
  }

  static async removeMember(req: AuthRequest, res: Response) {
    try {
      const { teamId, userId } = req.params;

      await query(
        `DELETE FROM auth_schema.team_members
         WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.teams.remove_member',
        resourceType: 'team',
        resourceId: teamId,
        details: { userId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      throw error;
    }
  }
}

