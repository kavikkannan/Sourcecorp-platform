import { Response } from 'express';
import { AuthRequest } from '../types';
import { HierarchyService } from '../services/hierarchy.service';
import { AuditService } from '../services/audit.service';

export class HierarchyController {
  /**
   * POST /api/admin/hierarchy/assign
   * Admin only: Assign a manager to a subordinate
   */
  static async assignManager(req: AuthRequest, res: Response) {
    try {
      const { subordinateId, managerId } = req.body;

      const hierarchy = await HierarchyService.assignManager(subordinateId, managerId);

      // Audit log
      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.hierarchy.assign',
        resourceType: 'hierarchy',
        resourceId: hierarchy.id,
        details: {
          subordinateId,
          managerId,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        message: 'Manager assigned successfully',
        hierarchy,
      });
    } catch (error: any) {
      if (error.message.includes('already has a manager')) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message.includes('circular') || error.message.includes('cycle')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('cannot be their own')) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * DELETE /api/admin/hierarchy/remove
   * Admin only: Remove a manager-subordinate relationship
   */
  static async removeManager(req: AuthRequest, res: Response) {
    try {
      const { subordinateId } = req.body;

      await HierarchyService.removeManager(subordinateId);

      // Audit log
      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.hierarchy.remove',
        resourceType: 'hierarchy',
        resourceId: subordinateId,
        details: {
          subordinateId,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        message: 'Manager relationship removed successfully',
      });
    } catch (error: any) {
      if (error.message.includes('No manager relationship')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * GET /api/admin/hierarchy/tree
   * Admin only: Get the full hierarchy tree
   */
  static async getHierarchyTree(req: AuthRequest, res: Response) {
    try {
      const tree = await HierarchyService.getHierarchyTree();
      
      // Remove circular references by removing manager property from each node
      const serializeNode = (node: any): any => {
        const { manager, ...nodeWithoutManager } = node;
        return {
          ...nodeWithoutManager,
          subordinates: node.subordinates.map((sub: any) => serializeNode(sub)),
        };
      };
      
      const serializedTree = {
        root: tree.root.map((node) => serializeNode(node)),
        maxDepth: tree.maxDepth,
      };
      
      res.json(serializedTree);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/users/me/manager
   * User level: Get the current user's manager
   */
  static async getMyManager(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const manager = await HierarchyService.getManager(req.user.userId);

      if (!manager) {
        return res.status(404).json({ error: 'No manager assigned' });
      }

      res.json(manager);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/users/me/subordinates
   * User level: Get the current user's direct subordinates
   */
  static async getMySubordinates(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subordinates = await HierarchyService.getSubordinates(req.user.userId);
      res.json(subordinates);
    } catch (error) {
      throw error;
    }
  }
}

