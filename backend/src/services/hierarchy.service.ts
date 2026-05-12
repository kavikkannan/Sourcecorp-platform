import { query } from '../db/pool';
import { User, UserHierarchy, HierarchyNode, HierarchyTree } from '../types';
import { logger } from '../config/logger';

export class HierarchyService {
  private static readonly MAX_DEPTH = 20;
  /**
   * Assign a manager to a subordinate
   * Validates: no existing manager, no self-reference, no cycles
   */
  static async assignManager(
    subordinateId: string,
    managerId: string
  ): Promise<UserHierarchy> {
    try {
      // Check if subordinate already has a manager
      const existingManager = await query(
        `SELECT id, manager_id FROM auth_schema.user_hierarchy
         WHERE subordinate_id = $1`,
        [subordinateId]
      );

      if (existingManager.rows.length > 0) {
        throw new Error('User already has a manager. Remove existing manager first.');
      }

      // Check self-reference
      if (subordinateId === managerId) {
        throw new Error('User cannot be their own manager');
      }

      // Check if both users exist
      const usersCheck = await query(
        `SELECT id FROM auth_schema.users
         WHERE id IN ($1, $2) AND is_active = true`,
        [subordinateId, managerId]
      );

      if (usersCheck.rows.length !== 2) {
        throw new Error('One or both users do not exist or are inactive');
      }

      // Check for potential cycle (the trigger will also catch this, but we check here for better error messages)
      const wouldCreateCycle = await this.wouldCreateCycle(subordinateId, managerId);
      if (wouldCreateCycle) {
        throw new Error('This assignment would create a circular hierarchy');
      }

      // Insert the hierarchy relationship
      const result = await query(
        `INSERT INTO auth_schema.user_hierarchy (manager_id, subordinate_id)
         VALUES ($1, $2)
         RETURNING id, manager_id, subordinate_id, created_at`,
        [managerId, subordinateId]
      );

      // Record history
      await query(
        `INSERT INTO auth_schema.hierarchy_history (subordinate_id, old_manager_id, new_manager_id, change_type)
         VALUES ($1, NULL, $2, 'ASSIGN')`,
        [subordinateId, managerId]
      );

      return result.rows[0];
    } catch (error: any) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation "auth_schema.user_hierarchy" does not exist')) {
        throw new Error('Hierarchy tables not found. Please run the migration: docker-compose exec backend npm run migrate:hierarchy');
      }
      throw error;
    }
  }

  /**
   * Remove a manager-subordinate relationship
   */
  static async removeManager(subordinateId: string): Promise<void> {
    const result = await query(
      `DELETE FROM auth_schema.user_hierarchy
       WHERE subordinate_id = $1
       RETURNING id`,
      [subordinateId]
    );

    if (result.rows.length === 0) {
      throw new Error('No manager relationship found for this user');
    }
  }

  /**
   * Get the manager of a user
   */
  static async getManager(userId: string): Promise<User | null> {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at, u.updated_at
       FROM auth_schema.users u
       JOIN auth_schema.user_hierarchy uh ON u.id = uh.manager_id
       WHERE uh.subordinate_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get all direct subordinates of a user
   */
  static async getSubordinates(userId: string): Promise<User[]> {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at, u.updated_at
       FROM auth_schema.users u
       JOIN auth_schema.user_hierarchy uh ON u.id = uh.subordinate_id
       WHERE uh.manager_id = $1
       ORDER BY u.first_name, u.last_name`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get the full hierarchy tree
   */
  static async getHierarchyTree(): Promise<HierarchyTree> {
    try {
      // Get all hierarchy relationships (only include relationships where subordinate is active)
      // Manager can be inactive, but we'll handle that by making the subordinate a root
      const hierarchyResult = await query(
      `SELECT uh.manager_id, uh.subordinate_id, uh.created_at,
              u1.email as manager_email, u1.first_name as manager_first_name, u1.last_name as manager_last_name,
              u2.email as subordinate_email, u2.first_name as subordinate_first_name, u2.last_name as subordinate_last_name,
              u1.is_active as manager_is_active
       FROM auth_schema.user_hierarchy uh
       JOIN auth_schema.users u1 ON uh.manager_id = u1.id
       JOIN auth_schema.users u2 ON uh.subordinate_id = u2.id
       WHERE u2.is_active = true`
    );

      // Get all users without managers OR with inactive managers (potential roots)
      const rootUsersResult = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at, u.updated_at
         FROM auth_schema.users u
         WHERE u.is_active = true
         AND (
           NOT EXISTS (
             SELECT 1 FROM auth_schema.user_hierarchy uh
             JOIN auth_schema.users m ON uh.manager_id = m.id
             WHERE uh.subordinate_id = u.id AND m.is_active = true
           )
         )
         ORDER BY u.first_name, u.last_name`
      );

      // Build a map of user IDs to nodes
      const userMap = new Map<string, HierarchyNode>();
      const relationships = hierarchyResult.rows;

      // Initialize all users as nodes
      const allUsersResult = await query(
        `SELECT id, email, first_name, last_name, is_active, created_at, updated_at
         FROM auth_schema.users
         WHERE is_active = true`
      );

      allUsersResult.rows.forEach((user: User) => {
        userMap.set(user.id, {
          user,
          subordinates: [],
          depth: 0,
        });
      });

      // Build the tree structure
      // Only create relationships if both manager and subordinate are active
      relationships.forEach((rel: any) => {
        const managerNode = userMap.get(rel.manager_id);
        const subordinateNode = userMap.get(rel.subordinate_id);

        // Only create relationship if manager is active
        // If manager is inactive, the subordinate will appear as a root node
        if (managerNode && subordinateNode && rel.manager_is_active === true) {
          subordinateNode.manager = managerNode;
          managerNode.subordinates.push(subordinateNode);
        }
      });

      // Calculate depths
      const calculateDepth = (node: HierarchyNode, visited: Set<string> = new Set()): number => {
        if (visited.has(node.user.id)) {
          return 0; // Cycle detected (shouldn't happen due to constraints)
        }
        visited.add(node.user.id);

        if (node.manager) {
          node.depth = calculateDepth(node.manager, visited) + 1;
        } else {
          node.depth = 0;
        }

        return node.depth;
      };

      // Calculate depths for all nodes
      userMap.forEach((node) => {
        if (!node.manager) {
          calculateDepth(node);
        }
      });

      // Propagate depth to all subordinates
      const propagateDepth = (node: HierarchyNode) => {
        node.subordinates.forEach((sub) => {
          sub.depth = node.depth + 1;
          propagateDepth(sub);
        });
      };

      rootUsersResult.rows.forEach((rootUser: User) => {
        const rootNode = userMap.get(rootUser.id);
        if (rootNode) {
          propagateDepth(rootNode);
        }
      });

      // Get root nodes - users without active managers
      // This includes:
      // 1. Users with no manager at all
      // 2. Users whose manager is inactive (they become root nodes)
      const rootNodes: HierarchyNode[] = [];
      
      // Add all users that don't have an active manager
      userMap.forEach((node) => {
        // If user has no manager, or manager is inactive, they're a root
        if (!node.manager) {
          rootNodes.push(node);
        }
      });
      
      // Also ensure all users from rootUsersResult are included
      rootUsersResult.rows.forEach((user: User) => {
        const node = userMap.get(user.id);
        if (node && !rootNodes.includes(node)) {
          rootNodes.push(node);
        }
      });

      // Find max depth
      let maxDepth = 0;
      userMap.forEach((node) => {
        if (node.depth > maxDepth) {
          maxDepth = node.depth;
        }
      });

      return {
        root: rootNodes,
        maxDepth,
      };
    } catch (error: any) {
      // Check if table doesn't exist - return empty tree instead of crashing
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation "auth_schema.user_hierarchy" does not exist')) {
        logger.warn('Hierarchy table does not exist, returning empty tree');
        return {
          root: [],
          maxDepth: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Get hierarchy history for a user
   */
  static async getHierarchyHistory(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT 
        hh.id,
        hh.subordinate_id,
        hh.old_manager_id,
        hh.new_manager_id,
        hh.change_type,
        hh.created_at,
        s.email as subordinate_email,
        s.first_name as subordinate_first_name,
        s.last_name as subordinate_last_name,
        om.email as old_manager_email,
        om.first_name as old_manager_first_name,
        om.last_name as old_manager_last_name,
        nm.email as new_manager_email,
        nm.first_name as new_manager_first_name,
        nm.last_name as new_manager_last_name
      FROM auth_schema.hierarchy_history hh
      JOIN auth_schema.users s ON hh.subordinate_id = s.id
      LEFT JOIN auth_schema.users om ON hh.old_manager_id = om.id
      LEFT JOIN auth_schema.users nm ON hh.new_manager_id = nm.id
      WHERE hh.subordinate_id = $1
      ORDER BY hh.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Check if assigning a manager would create a cycle
   */
  private static async wouldCreateCycle(
    subordinateId: string,
    managerId: string
  ): Promise<boolean> {
    // If the manager is the subordinate, it's a self-reference (handled separately)
    if (managerId === subordinateId) {
      return false; // Not a cycle, just invalid
    }

    // Traverse up from the manager to see if we reach the subordinate
    const visited = new Set<string>();
    let currentId: string | null = managerId;

    while (currentId) {
      if (currentId === subordinateId) {
        return true; // Cycle detected
      }

      if (visited.has(currentId)) {
        break; // Already visited this node
      }

      visited.add(currentId);

      // Get the manager of currentId
      const result = await query(
        `SELECT manager_id FROM auth_schema.user_hierarchy
         WHERE subordinate_id = $1`,
        [currentId]
      );

      if (result.rows.length === 0) {
        break; // No manager, we've reached the top
      }

      currentId = result.rows[0].manager_id;
    }

    return false;
  }

  /**
   * Check if user A is a subordinate of user B (direct or indirect)
   */
  static async isSubordinateOf(
    potentialSubordinateId: string,
    potentialManagerId: string
  ): Promise<boolean> {
    let currentId: string | null = potentialSubordinateId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === potentialManagerId) {
        return true;
      }

      if (visited.has(currentId)) {
        break;
      }

      visited.add(currentId);

      const result = await query(
        `SELECT manager_id FROM auth_schema.user_hierarchy
         WHERE subordinate_id = $1`,
        [currentId]
      );

      if (result.rows.length === 0) {
        break;
      }

      currentId = result.rows[0].manager_id;
    }

    return false;
  }

  /**
   * Get all subordinates recursively (including indirect subordinates)
   * Uses recursive SQL CTE for optimal performance
   */
  static async getAllSubordinates(userId: string): Promise<User[]> {
    const result = await query(
      `WITH RECURSIVE subordinate_tree AS (
        -- Direct subordinates
        SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at, u.updated_at, 1 as depth
        FROM auth_schema.users u
        JOIN auth_schema.user_hierarchy uh ON u.id = uh.subordinate_id
        WHERE uh.manager_id = $1 AND u.is_active = true
        
        UNION ALL
        
        -- Indirect subordinates
        SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at, u.updated_at, st.depth + 1
        FROM auth_schema.users u
        JOIN auth_schema.user_hierarchy uh ON u.id = uh.subordinate_id
        JOIN subordinate_tree st ON uh.manager_id = st.id
        WHERE u.is_active = true AND st.depth < $2
      )
      SELECT id, email, first_name, last_name, is_active, created_at, updated_at
      FROM subordinate_tree
      ORDER BY first_name, last_name`,
      [userId, this.MAX_DEPTH]
    );

    return result.rows;
  }

  /**
   * Get the depth of a user in the hierarchy (0 = root)
   */
  static async getUserDepth(userId: string): Promise<number> {
    const result = await query(
      `WITH RECURSIVE depth_tree AS (
        SELECT subordinate_id, manager_id, 0 as depth
        FROM auth_schema.user_hierarchy
        WHERE subordinate_id = $1
        
        UNION ALL
        
        SELECT uh.subordinate_id, uh.manager_id, dt.depth + 1
        FROM auth_schema.user_hierarchy uh
        JOIN depth_tree dt ON uh.subordinate_id = dt.manager_id
        WHERE dt.depth < $2
      )
      SELECT MAX(depth) as depth FROM depth_tree`,
      [userId, this.MAX_DEPTH]
    );

    return result.rows[0]?.depth ?? 0;
  }

  /**
   * Transfer a subordinate from their current manager to a new manager (atomic)
   */
  static async transferManager(
    subordinateId: string,
    newManagerId: string
  ): Promise<UserHierarchy> {
    // Check self-reference
    if (subordinateId === newManagerId) {
      throw new Error('User cannot be their own manager');
    }

    // Check if both users exist and are active
    const usersCheck = await query(
      `SELECT id FROM auth_schema.users
       WHERE id IN ($1, $2) AND is_active = true`,
      [subordinateId, newManagerId]
    );

    if (usersCheck.rows.length !== 2) {
      throw new Error('One or both users do not exist or are inactive');
    }

    // Check for potential cycle
    const wouldCreateCycle = await this.wouldCreateCycle(subordinateId, newManagerId);
    if (wouldCreateCycle) {
      throw new Error('This transfer would create a circular hierarchy');
    }

    // Check depth limit
    const newManagerDepth = await this.getUserDepth(newManagerId);
    if (newManagerDepth + 1 >= this.MAX_DEPTH) {
      throw new Error(`Hierarchy depth limit (${this.MAX_DEPTH}) would be exceeded`);
    }

    // Atomic transfer: delete old, insert new in one transaction
    const result = await query(
      `WITH deleted AS (
        DELETE FROM auth_schema.user_hierarchy
        WHERE subordinate_id = $1
        RETURNING manager_id as old_manager_id
      )
      INSERT INTO auth_schema.user_hierarchy (manager_id, subordinate_id)
      SELECT $2, $1
      FROM deleted
      RETURNING id, manager_id, subordinate_id, created_at`,
      [subordinateId, newManagerId]
    );

    if (result.rows.length === 0) {
      throw new Error('User does not have an existing manager to transfer from');
    }

    // Record history
    await query(
      `INSERT INTO auth_schema.hierarchy_history (subordinate_id, old_manager_id, new_manager_id, change_type)
       VALUES ($1, $2, $3, 'TRANSFER')`,
      [subordinateId, result.rows[0].old_manager_id, newManagerId]
    );

    return result.rows[0];
  }

  /**
   * Batch assign multiple subordinates to a manager
   */
  static async batchAssignManager(
    subordinateIds: string[],
    managerId: string
  ): Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }> {
    const succeeded: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const subordinateId of subordinateIds) {
      try {
        await this.assignManager(subordinateId, managerId);
        succeeded.push(subordinateId);
      } catch (error: any) {
        failed.push({ id: subordinateId, reason: error.message });
      }
    }

    return { succeeded, failed };
  }

}
