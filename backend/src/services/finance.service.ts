import { query } from '../db/pool';
import { logger } from '../config/logger';
import { AuditService } from './audit.service';
import { TemplateService } from './template.service';
import { TemplateValidationService } from './template-validation.service';
import {
  EligibilityRule,
  EligibilityCalculation,
  ObligationSheet,
  ObligationItem,
  CAMEntry,
} from '../types';

export class FinanceService {
  
  // ============================================
  // ELIGIBILITY CALCULATION
  // ============================================
  
  static async getEligibilityRule(loanType: string): Promise<EligibilityRule | null> {
    const result = await query(
      `SELECT * FROM finance_schema.eligibility_rules 
       WHERE loan_type = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [loanType]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      id: result.rows[0].id,
      loan_type: result.rows[0].loan_type,
      min_age: parseInt(result.rows[0].min_age, 10),
      max_age: parseInt(result.rows[0].max_age, 10),
      max_foir: parseFloat(result.rows[0].max_foir),
      income_multiplier: parseFloat(result.rows[0].income_multiplier),
      created_by: result.rows[0].created_by,
      created_at: result.rows[0].created_at,
    };
  }

  static async createEligibilityRule(data: {
    loan_type: string;
    min_age: number;
    max_age: number;
    max_foir: number;
    income_multiplier: number;
    created_by: string;
  }): Promise<EligibilityRule> {
    const result = await query(
      `INSERT INTO finance_schema.eligibility_rules 
       (loan_type, min_age, max_age, max_foir, income_multiplier, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.loan_type,
        data.min_age,
        data.max_age,
        data.max_foir,
        data.income_multiplier,
        data.created_by,
      ]
    );

    return {
      id: result.rows[0].id,
      loan_type: result.rows[0].loan_type,
      min_age: parseInt(result.rows[0].min_age, 10),
      max_age: parseInt(result.rows[0].max_age, 10),
      max_foir: parseFloat(result.rows[0].max_foir),
      income_multiplier: parseFloat(result.rows[0].income_multiplier),
      created_by: result.rows[0].created_by,
      created_at: result.rows[0].created_at,
    };
  }

  static async calculateEligibility(data: {
    case_id: string;
    monthly_income: number;
    requested_amount: number;
    calculated_by: string;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<EligibilityCalculation> {
    // Get case to determine loan type
    const caseResult = await query(
      `SELECT loan_type FROM crm_schema.cases WHERE id = $1`,
      [data.case_id]
    );

    if (caseResult.rows.length === 0) {
      throw new Error('Case not found');
    }

    const loanType = caseResult.rows[0].loan_type;

    // Get eligibility rule for this loan type
    let rule = await this.getEligibilityRule(loanType);

    // If no rule exists, create a default one
    if (!rule) {
      logger.warn(`No eligibility rule found for loan type ${loanType}, creating default rule`);
      rule = await this.createEligibilityRule({
        loan_type: loanType,
        min_age: 21,
        max_age: 65,
        max_foir: 0.60, // 60% FOIR
        income_multiplier: 60, // 60 times monthly income
        created_by: data.calculated_by,
      });
    }

    // Calculate eligible amount: monthly_income * income_multiplier
    const eligibleAmount = data.monthly_income * rule.income_multiplier;

    // Check if requested amount is within eligible amount
    const result = data.requested_amount <= eligibleAmount ? 'ELIGIBLE' : 'NOT_ELIGIBLE';

    // Store rule snapshot
    const ruleSnapshot = {
      loan_type: rule.loan_type,
      min_age: rule.min_age,
      max_age: rule.max_age,
      max_foir: rule.max_foir,
      income_multiplier: rule.income_multiplier,
      rule_id: rule.id,
    };

    // Save calculation
    const calcResult = await query(
      `INSERT INTO finance_schema.eligibility_calculations 
       (case_id, monthly_income, eligible_amount, requested_amount, result, rule_snapshot, calculated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.case_id,
        data.monthly_income,
        eligibleAmount,
        data.requested_amount,
        result,
        JSON.stringify(ruleSnapshot),
        data.calculated_by,
      ]
    );

    const calculation = {
      id: calcResult.rows[0].id,
      case_id: calcResult.rows[0].case_id,
      monthly_income: parseFloat(calcResult.rows[0].monthly_income),
      eligible_amount: parseFloat(calcResult.rows[0].eligible_amount),
      requested_amount: parseFloat(calcResult.rows[0].requested_amount),
      result: calcResult.rows[0].result,
      rule_snapshot: calcResult.rows[0].rule_snapshot,
      calculated_by: calcResult.rows[0].calculated_by,
      calculated_at: calcResult.rows[0].calculated_at,
    };

    // Audit log
    await AuditService.createLog({
      userId: data.calculated_by,
      action: 'finance.eligibility.calculate',
      resourceType: 'eligibility_calculation',
      resourceId: calculation.id,
      details: {
        case_id: data.case_id,
        monthly_income: data.monthly_income,
        eligible_amount: calculation.eligible_amount,
        requested_amount: data.requested_amount,
        result: calculation.result,
      },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return calculation;
  }

  static async getEligibilityByCaseId(caseId: string): Promise<EligibilityCalculation | null> {
    const result = await query(
      `SELECT * FROM finance_schema.eligibility_calculations 
       WHERE case_id = $1 
       ORDER BY calculated_at DESC 
       LIMIT 1`,
      [caseId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      id: result.rows[0].id,
      case_id: result.rows[0].case_id,
      monthly_income: parseFloat(result.rows[0].monthly_income),
      eligible_amount: parseFloat(result.rows[0].eligible_amount),
      requested_amount: parseFloat(result.rows[0].requested_amount),
      result: result.rows[0].result,
      rule_snapshot: result.rows[0].rule_snapshot,
      calculated_by: result.rows[0].calculated_by,
      calculated_at: result.rows[0].calculated_at,
    };
  }

  // ============================================
  // OBLIGATION SHEET
  // ============================================

  static async createObligationSheet(data: {
    case_id: string;
    template_id?: string;
    items: Array<Record<string, any>>; // Template-driven items with all fields
    net_income: number;
    created_by: string;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<ObligationSheet & { items: ObligationItem[] }> {
    // Get template
    let template = null;
    if (data.template_id) {
      template = await TemplateService.getObligationTemplate(data.template_id);
    } else {
      template = await TemplateService.getActiveObligationTemplate();
    }

    if (!template) {
      throw new Error('Obligation template not found. Please provide template_id or ensure an active template exists');
    }

    // Validate obligation items against template
    const validationErrors = TemplateValidationService.validateObligationItems(
      data.items,
      template.fields
    );

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map(e => e.message).join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    // Calculate total obligation (find the field that represents monthly_emi or similar)
    // For backward compatibility, look for 'monthly_emi' or 'emi' field
    const emiField = template.fields.find(f => 
      f.field_key.toLowerCase().includes('emi') || 
      f.field_key.toLowerCase().includes('amount') ||
      f.field_type === 'currency'
    );

    let totalObligation = 0;
    if (emiField) {
      totalObligation = data.items.reduce((sum, item) => {
        const emiValue = item[emiField.field_key] || 0;
        return sum + (typeof emiValue === 'number' ? emiValue : parseFloat(emiValue) || 0);
      }, 0);
    } else {
      // Fallback: sum all numeric/currency fields
      data.items.forEach(item => {
        Object.values(item).forEach(value => {
          if (typeof value === 'number') {
            totalObligation += value;
          } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
            totalObligation += parseFloat(value);
          }
        });
      });
    }

    // Create template snapshot
    const templateSnapshot = TemplateValidationService.createTemplateSnapshot(template);

    // Create obligation sheet
    const sheetResult = await query(
      `INSERT INTO finance_schema.obligation_sheets 
       (case_id, template_id, template_snapshot, total_obligation, net_income, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.case_id, template.id, JSON.stringify(templateSnapshot), totalObligation, data.net_income, data.created_by]
    );

    const sheetId = sheetResult.rows[0].id;

    // Create obligation items
    const items: ObligationItem[] = [];
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const itemResult = await query(
        `INSERT INTO finance_schema.obligation_items 
         (obligation_sheet_id, item_data, order_index)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [sheetId, JSON.stringify(item), i]
      );

      items.push({
        id: itemResult.rows[0].id,
        obligation_sheet_id: itemResult.rows[0].obligation_sheet_id,
        item_data: itemResult.rows[0].item_data,
        order_index: itemResult.rows[0].order_index,
        created_at: itemResult.rows[0].created_at,
      });
    }

    const sheet = {
      id: sheetResult.rows[0].id,
      case_id: sheetResult.rows[0].case_id,
      template_id: sheetResult.rows[0].template_id,
      template_snapshot: sheetResult.rows[0].template_snapshot,
      total_obligation: parseFloat(sheetResult.rows[0].total_obligation),
      net_income: parseFloat(sheetResult.rows[0].net_income),
      created_by: sheetResult.rows[0].created_by,
      created_at: sheetResult.rows[0].created_at,
      updated_at: sheetResult.rows[0].updated_at,
      items,
    };

    // Audit log
    await AuditService.createLog({
      userId: data.created_by,
      action: 'finance.obligation.create',
      resourceType: 'obligation_sheet',
      resourceId: sheet.id,
      details: {
        case_id: data.case_id,
        total_obligation: sheet.total_obligation,
        net_income: sheet.net_income,
        item_count: items.length,
        template_id: template.id,
        template_name: template.template_name,
      },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return sheet;
  }

  static async updateObligationSheet(data: {
    sheet_id: string;
    template_id?: string;
    items: Array<Record<string, any>>; // Template-driven items
    net_income: number;
    updated_by: string;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<ObligationSheet & { items: ObligationItem[] }> {
    // Get existing sheet to check for template
    const existingSheet = await query(
      `SELECT * FROM finance_schema.obligation_sheets WHERE id = $1`,
      [data.sheet_id]
    );

    if (existingSheet.rows.length === 0) {
      throw new Error('Obligation sheet not found');
    }

    const sheetRow = existingSheet.rows[0];
    let template = null;
    
    // Get template if provided or from existing sheet
    if (data.template_id) {
      template = await TemplateService.getObligationTemplate(data.template_id);
    } else if (sheetRow.template_id) {
      template = await TemplateService.getObligationTemplate(sheetRow.template_id);
    } else {
      template = await TemplateService.getActiveObligationTemplate();
    }

    // Calculate total obligation
    let totalObligation = 0;
    if (template) {
      const emiField = template.fields.find(f => 
        f.field_key.toLowerCase().includes('emi') || 
        f.field_key.toLowerCase().includes('amount') ||
        f.field_type === 'currency'
      );
      if (emiField) {
        totalObligation = data.items.reduce((sum, item) => {
          const emiValue = item[emiField.field_key] || 0;
          return sum + (typeof emiValue === 'number' ? emiValue : parseFloat(String(emiValue)) || 0);
        }, 0);
      }
    } else {
      // Fallback: sum all numeric values
      data.items.forEach(item => {
        Object.values(item).forEach(value => {
          if (typeof value === 'number') {
            totalObligation += value;
          } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
            totalObligation += parseFloat(value);
          }
        });
      });
    }

    // Update obligation sheet
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    updateFields.push(`total_obligation = $${paramCount++}`);
    updateValues.push(totalObligation);
    
    updateFields.push(`net_income = $${paramCount++}`);
    updateValues.push(data.net_income);
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    if (data.template_id && data.template_id !== sheetRow.template_id) {
      updateFields.push(`template_id = $${paramCount++}`);
      updateValues.push(data.template_id);
      
      if (template) {
        const templateSnapshot = TemplateValidationService.createTemplateSnapshot(template);
        updateFields.push(`template_snapshot = $${paramCount++}`);
        updateValues.push(JSON.stringify(templateSnapshot));
      }
    }

    updateValues.push(data.sheet_id);
    const sheetResult = await query(
      `UPDATE finance_schema.obligation_sheets 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      updateValues
    );

    // Check if item_data column exists
    const columnCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'obligation_items'
        AND column_name = 'item_data'
      )`
    );
    
    const hasItemData = columnCheck.rows[0].exists;

    // Delete existing items
    await query(
      `DELETE FROM finance_schema.obligation_items WHERE obligation_sheet_id = $1`,
      [data.sheet_id]
    );

    // Create new items
    const items: ObligationItem[] = [];
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      let itemResult;
      
      if (hasItemData) {
        // New schema: use item_data
        itemResult = await query(
          `INSERT INTO finance_schema.obligation_items 
           (obligation_sheet_id, item_data, order_index)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [data.sheet_id, JSON.stringify(item), i]
        );
      } else {
        // Old schema: use description and monthly_emi (backward compatibility)
        const description = item.description || item.description || '';
        const monthlyEmi = item.monthly_emi || (typeof item.monthly_emi === 'number' ? item.monthly_emi : 0);
        itemResult = await query(
          `INSERT INTO finance_schema.obligation_items 
           (obligation_sheet_id, description, monthly_emi)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [data.sheet_id, description, monthlyEmi]
        );
      }

      if (hasItemData) {
        items.push({
          id: itemResult.rows[0].id,
          obligation_sheet_id: itemResult.rows[0].obligation_sheet_id,
          item_data: itemResult.rows[0].item_data || item,
          order_index: itemResult.rows[0].order_index || i,
          created_at: itemResult.rows[0].created_at,
        });
      } else {
        // Backward compatibility: convert to item_data format
        items.push({
          id: itemResult.rows[0].id,
          obligation_sheet_id: itemResult.rows[0].obligation_sheet_id,
          item_data: {
            description: itemResult.rows[0].description,
            monthly_emi: parseFloat(itemResult.rows[0].monthly_emi),
          },
          order_index: i,
          created_at: itemResult.rows[0].created_at,
        });
      }
    }

    const sheet = {
      id: sheetResult.rows[0].id,
      case_id: sheetResult.rows[0].case_id,
      template_id: sheetResult.rows[0].template_id,
      template_snapshot: sheetResult.rows[0].template_snapshot,
      total_obligation: parseFloat(sheetResult.rows[0].total_obligation),
      net_income: parseFloat(sheetResult.rows[0].net_income),
      created_by: sheetResult.rows[0].created_by,
      created_at: sheetResult.rows[0].created_at,
      updated_at: sheetResult.rows[0].updated_at,
      items,
    };

    // Audit log
    await AuditService.createLog({
      userId: data.updated_by,
      action: 'finance.obligation.update',
      resourceType: 'obligation_sheet',
      resourceId: sheet.id,
      details: {
        case_id: sheet.case_id,
        total_obligation: sheet.total_obligation,
        net_income: sheet.net_income,
        item_count: items.length,
        template_id: template?.id,
      },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return sheet;
  }

  static async getObligationSheetByCaseId(caseId: string): Promise<(ObligationSheet & { items: ObligationItem[] }) | null> {
    const sheetResult = await query(
      `SELECT * FROM finance_schema.obligation_sheets 
       WHERE case_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [caseId]
    );

    if (sheetResult.rows.length === 0) {
      return null;
    }

    const sheet = sheetResult.rows[0];

    // Get items - handle both old and new schema
    const itemsResult = await query(
      `SELECT * FROM finance_schema.obligation_items 
       WHERE obligation_sheet_id = $1 
       ORDER BY COALESCE(order_index, 0) ASC, created_at ASC`,
      [sheet.id]
    );

    const items = itemsResult.rows.map((row: any) => ({
      id: row.id,
      obligation_sheet_id: row.obligation_sheet_id,
      item_data: row.item_data || (row.description ? { description: row.description, monthly_emi: row.monthly_emi } : {}), // Backward compatibility
      order_index: row.order_index || 0,
      created_at: row.created_at,
    }));

    return {
      id: sheet.id,
      case_id: sheet.case_id,
      template_id: sheet.template_id,
      template_snapshot: sheet.template_snapshot,
      total_obligation: parseFloat(sheet.total_obligation),
      net_income: parseFloat(sheet.net_income),
      created_by: sheet.created_by,
      created_at: sheet.created_at,
      updated_at: sheet.updated_at,
      items,
    };
  }

  // ============================================
  // CAM / WORKING SHEET
  // ============================================

  static async createCAMEntry(data: {
    case_id: string;
    template_id?: string;
    loan_type?: string; // Used to find template if template_id not provided
    cam_data: any;
    user_added_fields?: Record<string, { label: string; type: string }>;
    created_by: string;
  }, auditData: { ipAddress?: string; userAgent?: string }): Promise<CAMEntry> {
    // Get template
    let template = null;
    if (data.template_id) {
      template = await TemplateService.getCAMTemplate(data.template_id);
    } else if (data.loan_type) {
      template = await TemplateService.getCAMTemplateByLoanType(data.loan_type);
    }

    if (!template) {
      throw new Error('CAM template not found. Please provide template_id or loan_type');
    }

    // Validate CAM data against template
    const validationErrors = TemplateValidationService.validateCAMData(
      data.cam_data,
      template.fields,
      data.user_added_fields
    );

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map(e => e.message).join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    // Create template snapshot
    const templateSnapshot = TemplateValidationService.createTemplateSnapshot(template);

    // Get latest version for this case
    const versionResult = await query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version 
       FROM finance_schema.cam_entries 
       WHERE case_id = $1`,
      [data.case_id]
    );

    const version = parseInt(versionResult.rows[0].next_version, 10);

    // Create CAM entry
    const result = await query(
      `INSERT INTO finance_schema.cam_entries 
       (case_id, template_id, template_snapshot, cam_data, user_added_fields, version, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.case_id,
        template.id,
        JSON.stringify(templateSnapshot),
        JSON.stringify(data.cam_data),
        data.user_added_fields ? JSON.stringify(data.user_added_fields) : '{}',
        version,
        data.created_by,
      ]
    );

    const entry = {
      id: result.rows[0].id,
      case_id: result.rows[0].case_id,
      template_id: result.rows[0].template_id,
      template_snapshot: result.rows[0].template_snapshot,
      cam_data: result.rows[0].cam_data,
      user_added_fields: result.rows[0].user_added_fields || {},
      version: parseInt(result.rows[0].version, 10),
      created_by: result.rows[0].created_by,
      created_at: result.rows[0].created_at,
    };

    // Audit log
    await AuditService.createLog({
      userId: data.created_by,
      action: 'finance.cam.create',
      resourceType: 'cam_entry',
      resourceId: entry.id,
      details: {
        case_id: data.case_id,
        version: entry.version,
        template_id: template.id,
        template_name: template.template_name,
      },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return entry;
  }

  static async getCAMEntryByCaseId(caseId: string, version?: number): Promise<CAMEntry | null> {
    let queryStr = `SELECT * FROM finance_schema.cam_entries WHERE case_id = $1`;
    const params: any[] = [caseId];

    if (version) {
      queryStr += ` AND version = $2`;
      params.push(version);
    } else {
      queryStr += ` ORDER BY version DESC LIMIT 1`;
    }

    const result = await query(queryStr, params);

    if (result.rows.length === 0) {
      return null;
    }

    return {
      id: result.rows[0].id,
      case_id: result.rows[0].case_id,
      template_id: result.rows[0].template_id,
      template_snapshot: result.rows[0].template_snapshot,
      cam_data: result.rows[0].cam_data,
      user_added_fields: result.rows[0].user_added_fields || {},
      version: parseInt(result.rows[0].version, 10),
      created_by: result.rows[0].created_by,
      created_at: result.rows[0].created_at,
    };
  }

  static async getAllCAMVersions(caseId: string): Promise<CAMEntry[]> {
    const result = await query(
      `SELECT * FROM finance_schema.cam_entries 
       WHERE case_id = $1 
       ORDER BY version DESC`,
      [caseId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      case_id: row.case_id,
      template_id: row.template_id,
      template_snapshot: row.template_snapshot,
      cam_data: row.cam_data,
      user_added_fields: row.user_added_fields || {},
      version: parseInt(row.version, 10),
      created_by: row.created_by,
      created_at: row.created_at,
    }));
  }
}

