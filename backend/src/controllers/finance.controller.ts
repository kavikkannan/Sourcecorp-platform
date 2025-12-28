import { Response } from 'express';
import { AuthRequest } from '../types';
import { FinanceService } from '../services/finance.service';
import { ExportService } from '../services/export.service';
import { query } from '../db/pool';

export class FinanceController {
  
  // ============================================
  // ELIGIBILITY
  // ============================================

  static async calculateEligibility(req: AuthRequest, res: Response) {
    try {
      const { case_id, monthly_income, requested_amount } = req.body;

      const calculation = await FinanceService.calculateEligibility(
        {
          case_id,
          monthly_income,
          requested_amount,
          calculated_by: req.user!.userId,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json({
        id: calculation.id,
        case_id: calculation.case_id,
        monthly_income: calculation.monthly_income,
        eligible_amount: calculation.eligible_amount,
        requested_amount: calculation.requested_amount,
        result: calculation.result,
        rule_snapshot: calculation.rule_snapshot,
        calculated_at: calculation.calculated_at,
      });
    } catch (error: any) {
      if (error.message === 'Case not found') {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  static async getEligibility(req: AuthRequest, res: Response) {
    try {
      const { caseId } = req.params;

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

      const caseCheck = await query(
        `SELECT id FROM crm_schema.cases WHERE id = $1`,
        [caseId]
      );

      if (caseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // RBAC check
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        const accessCheck = await query(
          `SELECT 1 FROM crm_schema.cases c
           LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
           WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
          [caseId, req.user!.userId]
        );

        if (accessCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const calculation = await FinanceService.getEligibilityByCaseId(caseId);

      if (!calculation) {
        return res.status(404).json({ error: 'Eligibility calculation not found' });
      }

      res.json({
        id: calculation.id,
        case_id: calculation.case_id,
        monthly_income: calculation.monthly_income,
        eligible_amount: calculation.eligible_amount,
        requested_amount: calculation.requested_amount,
        result: calculation.result,
        rule_snapshot: calculation.rule_snapshot,
        calculated_at: calculation.calculated_at,
      });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // OBLIGATION
  // ============================================

  static async createObligationSheet(req: AuthRequest, res: Response) {
    try {
      const { case_id, items, net_income } = req.body;

      // Verify case exists
      const caseCheck = await query(
        `SELECT id FROM crm_schema.cases WHERE id = $1`,
        [case_id]
      );

      if (caseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // Check if sheet already exists
      const existingSheet = await FinanceService.getObligationSheetByCaseId(case_id);
      
      if (existingSheet) {
        // Update existing sheet
        const updated = await FinanceService.updateObligationSheet(
          {
            sheet_id: existingSheet.id,
            template_id: req.body.template_id,
            items,
            net_income,
            updated_by: req.user!.userId,
          },
          {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          }
        );

        return res.json({
          id: updated.id,
          case_id: updated.case_id,
          template_id: updated.template_id,
          template_snapshot: updated.template_snapshot,
          total_obligation: updated.total_obligation,
          net_income: updated.net_income,
          items: updated.items,
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        });
      }

      // Create new sheet
      const sheet = await FinanceService.createObligationSheet(
        {
          case_id,
          template_id: req.body.template_id,
          items,
          net_income,
          created_by: req.user!.userId,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json({
        id: sheet.id,
        case_id: sheet.case_id,
        template_id: sheet.template_id,
        template_snapshot: sheet.template_snapshot,
        total_obligation: sheet.total_obligation,
        net_income: sheet.net_income,
        items: sheet.items,
        created_at: sheet.created_at,
        updated_at: sheet.updated_at,
      });
    } catch (error) {
      throw error;
    }
  }

  static async getObligationSheet(req: AuthRequest, res: Response) {
    try {
      const { caseId } = req.params;

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

      const caseCheck = await query(
        `SELECT id FROM crm_schema.cases WHERE id = $1`,
        [caseId]
      );

      if (caseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // RBAC check
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        const accessCheck = await query(
          `SELECT 1 FROM crm_schema.cases c
           LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
           WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
          [caseId, req.user!.userId]
        );

        if (accessCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const sheet = await FinanceService.getObligationSheetByCaseId(caseId);

      if (!sheet) {
        return res.status(404).json({ error: 'Obligation sheet not found' });
      }

      res.json({
        id: sheet.id,
        case_id: sheet.case_id,
        template_id: sheet.template_id,
        template_snapshot: sheet.template_snapshot,
        total_obligation: sheet.total_obligation,
        net_income: sheet.net_income,
        items: sheet.items,
        created_at: sheet.created_at,
        updated_at: sheet.updated_at,
      });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // CAM
  // ============================================

  static async createCAMEntry(req: AuthRequest, res: Response) {
    try {
      const { case_id, template_id, loan_type, cam_data, user_added_fields } = req.body;

      // Verify case exists and get loan_type if not provided
      const caseCheck = await query(
        `SELECT id, loan_type FROM crm_schema.cases WHERE id = $1`,
        [case_id]
      );

      if (caseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      const caseLoanType = loan_type || caseCheck.rows[0].loan_type;

      const entry = await FinanceService.createCAMEntry(
        {
          case_id,
          template_id,
          loan_type: caseLoanType,
          cam_data,
          user_added_fields,
          created_by: req.user!.userId,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json({
        id: entry.id,
        case_id: entry.case_id,
        template_id: entry.template_id,
        template_snapshot: entry.template_snapshot,
        cam_data: entry.cam_data,
        user_added_fields: entry.user_added_fields,
        version: entry.version,
        created_at: entry.created_at,
      });
    } catch (error: any) {
      if (error.message.includes('Validation failed') || error.message.includes('template not found')) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  }

  static async getCAMEntry(req: AuthRequest, res: Response) {
    try {
      const { caseId } = req.params;
      const { version } = req.query;

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

      const caseCheck = await query(
        `SELECT id FROM crm_schema.cases WHERE id = $1`,
        [caseId]
      );

      if (caseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // RBAC check
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        const accessCheck = await query(
          `SELECT 1 FROM crm_schema.cases c
           LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
           WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
          [caseId, req.user!.userId]
        );

        if (accessCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const entry = await FinanceService.getCAMEntryByCaseId(
        caseId,
        version ? parseInt(version as string, 10) : undefined
      );

      if (!entry) {
        return res.status(404).json({ error: 'CAM entry not found' });
      }

      // Get all versions for history
      const allVersions = await FinanceService.getAllCAMVersions(caseId);

      res.json({
        id: entry.id,
        case_id: entry.case_id,
        template_id: entry.template_id,
        template_snapshot: entry.template_snapshot,
        cam_data: entry.cam_data,
        user_added_fields: entry.user_added_fields,
        version: entry.version,
        created_at: entry.created_at,
        versions: allVersions.map(v => ({
          id: v.id,
          version: v.version,
          created_at: v.created_at,
        })),
      });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // EXPORTS
  // ============================================

  static async exportEligibility(req: AuthRequest, res: Response) {
    try {
      const { caseId } = req.params;
      const { format } = req.query;

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

      const caseCheck = await query(
        `SELECT id FROM crm_schema.cases WHERE id = $1`,
        [caseId]
      );

      if (caseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // RBAC check
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        const accessCheck = await query(
          `SELECT 1 FROM crm_schema.cases c
           LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
           WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
          [caseId, req.user!.userId]
        );

        if (accessCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      let buffer: Buffer;
      let contentType: string;
      let filename: string;

      if (format === 'csv') {
        const csv = await ExportService.exportEligibilityCSV(caseId);
        buffer = Buffer.from(csv);
        contentType = 'text/csv';
        filename = `eligibility-${caseId}.csv`;
      } else if (format === 'xlsx') {
        buffer = await ExportService.exportEligibilityExcel(caseId);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `eligibility-${caseId}.xlsx`;
      } else if (format === 'pdf') {
        buffer = await ExportService.exportEligibilityPDF(caseId);
        contentType = 'application/pdf';
        filename = `eligibility-${caseId}.pdf`;
      } else {
        return res.status(400).json({ error: 'Invalid format. Must be csv, xlsx, or pdf' });
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  static async exportObligation(req: AuthRequest, res: Response) {
    try {
      const { caseId } = req.params;
      const { format } = req.query;

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

      const caseCheck = await query(
        `SELECT id FROM crm_schema.cases WHERE id = $1`,
        [caseId]
      );

      if (caseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // RBAC check
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        const accessCheck = await query(
          `SELECT 1 FROM crm_schema.cases c
           LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
           WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
          [caseId, req.user!.userId]
        );

        if (accessCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      let buffer: Buffer;
      let contentType: string;
      let filename: string;

      if (format === 'csv') {
        const csv = await ExportService.exportObligationCSV(caseId);
        buffer = Buffer.from(csv);
        contentType = 'text/csv';
        filename = `obligation-${caseId}.csv`;
      } else if (format === 'xlsx') {
        buffer = await ExportService.exportObligationExcel(caseId);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `obligation-${caseId}.xlsx`;
      } else if (format === 'pdf') {
        buffer = await ExportService.exportObligationPDF(caseId);
        contentType = 'application/pdf';
        filename = `obligation-${caseId}.pdf`;
      } else {
        return res.status(400).json({ error: 'Invalid format. Must be csv, xlsx, or pdf' });
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  static async exportCAM(req: AuthRequest, res: Response) {
    try {
      const { caseId } = req.params;
      const { format } = req.query;

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

      const caseCheck = await query(
        `SELECT id FROM crm_schema.cases WHERE id = $1`,
        [caseId]
      );

      if (caseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      // RBAC check
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        const accessCheck = await query(
          `SELECT 1 FROM crm_schema.cases c
           LEFT JOIN crm_schema.case_assignments ca ON c.id = ca.case_id
           WHERE c.id = $1 AND (c.created_by = $2 OR ca.assigned_to = $2)`,
          [caseId, req.user!.userId]
        );

        if (accessCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      let buffer: Buffer;
      let contentType: string;
      let filename: string;

      if (format === 'csv') {
        const csv = await ExportService.exportCAMCSV(caseId);
        buffer = Buffer.from(csv);
        contentType = 'text/csv';
        filename = `cam-${caseId}.csv`;
      } else if (format === 'xlsx') {
        buffer = await ExportService.exportCAMExcel(caseId);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `cam-${caseId}.xlsx`;
      } else if (format === 'pdf') {
        buffer = await ExportService.exportCAMPDF(caseId);
        contentType = 'application/pdf';
        filename = `cam-${caseId}.pdf`;
      } else {
        return res.status(400).json({ error: 'Invalid format. Must be csv, xlsx, or pdf' });
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }
}

