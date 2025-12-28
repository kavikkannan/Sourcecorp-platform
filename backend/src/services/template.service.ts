import { query } from '../db/pool';
import { CAMTemplate, CAMField, ObligationTemplate, ObligationField } from '../types';

export class TemplateService {
  
  // ============================================
  // CAM TEMPLATE MANAGEMENT
  // ============================================

  static async createCAMTemplate(data: {
    loan_type: string;
    template_name: string;
    sections: string[];
    fields: Array<{
      section_name: string;
      field_key: string;
      label: string;
      field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
      is_mandatory: boolean;
      is_user_addable: boolean;
      order_index: number;
      default_value?: string;
      validation_rules?: any;
      select_options?: string[];
    }>;
    created_by: string;
  }): Promise<CAMTemplate & { fields: CAMField[] }> {
    // Create template
    // Check if sections column exists and is required, or if we need to use template_definition
    const templateResult = await query(
      `INSERT INTO finance_schema.cam_templates 
       (loan_type, template_name, sections, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.loan_type, data.template_name, JSON.stringify(data.sections), data.created_by]
    );

    const templateId = templateResult.rows[0].id;

    // Create fields
    const fields: CAMField[] = [];
    for (const field of data.fields) {
      const fieldResult = await query(
        `INSERT INTO finance_schema.cam_fields 
         (template_id, section_name, field_key, label, field_type, is_mandatory, 
          is_user_addable, order_index, default_value, validation_rules, select_options)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          templateId,
          field.section_name,
          field.field_key,
          field.label,
          field.field_type,
          field.is_mandatory,
          field.is_user_addable,
          field.order_index,
          field.default_value || null,
          field.validation_rules ? JSON.stringify(field.validation_rules) : null,
          field.select_options ? JSON.stringify(field.select_options) : null,
        ]
      );

      const row = fieldResult.rows[0];
      fields.push({
        id: row.id,
        template_id: row.template_id,
        section_name: row.section_name,
        field_key: row.field_key,
        label: row.label,
        field_type: row.field_type,
        is_mandatory: row.is_mandatory,
        is_user_addable: row.is_user_addable,
        order_index: row.order_index,
        default_value: row.default_value,
        validation_rules: row.validation_rules,
        select_options: row.select_options,
        created_at: row.created_at,
      });
    }

    const template = {
      id: templateResult.rows[0].id,
      loan_type: templateResult.rows[0].loan_type,
      template_name: templateResult.rows[0].template_name,
      sections: templateResult.rows[0].sections,
      is_active: templateResult.rows[0].is_active,
      created_by: templateResult.rows[0].created_by,
      created_at: templateResult.rows[0].created_at,
      updated_at: templateResult.rows[0].updated_at,
      fields,
    };

    return template;
  }

  static async getCAMTemplate(templateId: string): Promise<(CAMTemplate & { fields: CAMField[] }) | null> {
    const templateResult = await query(
      `SELECT * FROM finance_schema.cam_templates WHERE id = $1`,
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      return null;
    }

    const template = templateResult.rows[0];

    const fieldsResult = await query(
      `SELECT * FROM finance_schema.cam_fields 
       WHERE template_id = $1 
       ORDER BY section_name, order_index`,
      [templateId]
    );

    const fields: CAMField[] = fieldsResult.rows.map(row => ({
      id: row.id,
      template_id: row.template_id,
      section_name: row.section_name,
      field_key: row.field_key,
      label: row.label,
      field_type: row.field_type,
      is_mandatory: row.is_mandatory,
      is_user_addable: row.is_user_addable,
      order_index: row.order_index,
      default_value: row.default_value,
      validation_rules: row.validation_rules,
      select_options: row.select_options,
      created_at: row.created_at,
    }));

    return {
      id: template.id,
      loan_type: template.loan_type,
      template_name: template.template_name,
      sections: template.sections,
      is_active: template.is_active,
      created_by: template.created_by,
      created_at: template.created_at,
      updated_at: template.updated_at,
      fields,
    };
  }

  static async getCAMTemplateByLoanType(loanType: string): Promise<(CAMTemplate & { fields: CAMField[] }) | null> {
    // Check if table exists first
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_templates'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      return null;
    }
    
    // Check if is_active column exists
    const columnCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'cam_templates'
        AND column_name = 'is_active'
      )`
    );
    
    const hasIsActive = columnCheck.rows[0].exists;
    
    // Use case-insensitive matching for loan_type
    const templateResult = await query(
      hasIsActive
        ? `SELECT * FROM finance_schema.cam_templates 
           WHERE LOWER(TRIM(loan_type)) = LOWER(TRIM($1)) AND is_active = true 
           ORDER BY created_at DESC 
           LIMIT 1`
        : `SELECT * FROM finance_schema.cam_templates 
           WHERE LOWER(TRIM(loan_type)) = LOWER(TRIM($1)) 
           ORDER BY created_at DESC 
           LIMIT 1`,
      [loanType]
    );

    if (templateResult.rows.length === 0) {
      return null;
    }

    return this.getCAMTemplate(templateResult.rows[0].id);
  }

  static async getAllCAMTemplates(): Promise<CAMTemplate[]> {
    const result = await query(
      `SELECT * FROM finance_schema.cam_templates 
       ORDER BY loan_type, template_name`,
      []
    );

    return result.rows.map(row => ({
      id: row.id,
      loan_type: row.loan_type,
      template_name: row.template_name,
      sections: row.sections || [],
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      fields: [], // Fields are not included in list view for performance
    }));
  }

  static async updateCAMTemplate(
    templateId: string,
    data: {
      template_name?: string;
      sections?: string[];
      is_active?: boolean;
      fields?: Array<{
        section_name: string;
        field_key: string;
        label: string;
        field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
        is_mandatory: boolean;
        is_user_addable: boolean;
        order_index: number;
        default_value?: string;
        validation_rules?: any;
        select_options?: string[];
      }>;
    }
  ): Promise<CAMTemplate & { fields: CAMField[] }> {
    // Update template
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.template_name !== undefined) {
      updates.push(`template_name = $${paramCount++}`);
      values.push(data.template_name);
    }
    if (data.sections !== undefined) {
      updates.push(`sections = $${paramCount++}`);
      values.push(JSON.stringify(data.sections));
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }

    if (updates.length > 0) {
      values.push(templateId);
      await query(
        `UPDATE finance_schema.cam_templates 
         SET ${updates.join(', ')} 
         WHERE id = $${paramCount}`,
        values
      );
    }

    // Update fields if provided
    if (data.fields !== undefined) {
      // Delete existing fields
      await query(
        `DELETE FROM finance_schema.cam_fields WHERE template_id = $1`,
        [templateId]
      );

      // Insert new fields
      for (const field of data.fields) {
        await query(
          `INSERT INTO finance_schema.cam_fields 
           (template_id, section_name, field_key, label, field_type, is_mandatory, 
            is_user_addable, order_index, default_value, validation_rules, select_options)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            templateId,
            field.section_name,
            field.field_key,
            field.label,
            field.field_type,
            field.is_mandatory,
            field.is_user_addable,
            field.order_index,
            field.default_value || null,
            field.validation_rules ? JSON.stringify(field.validation_rules) : null,
            field.select_options ? JSON.stringify(field.select_options) : null,
          ]
        );
      }
    }

    const updated = await this.getCAMTemplate(templateId);
    if (!updated) {
      throw new Error('Template not found after update');
    }
    return updated;
  }

  // ============================================
  // OBLIGATION TEMPLATE MANAGEMENT
  // ============================================

  static async createObligationTemplate(data: {
    template_name: string;
    sections: string[];
    fields: Array<{
      field_key: string;
      label: string;
      field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
      is_mandatory: boolean;
      is_repeatable: boolean;
      order_index: number;
      default_value?: string;
      validation_rules?: any;
      select_options?: string[];
    }>;
    created_by: string;
  }): Promise<ObligationTemplate & { fields: ObligationField[] }> {
    // Validate input
    if (!data.template_name) {
      throw new Error('Template name is required');
    }
    if (!data.sections || !Array.isArray(data.sections)) {
      throw new Error('Sections must be an array');
    }
    if (!data.fields || !Array.isArray(data.fields)) {
      throw new Error('Fields must be an array');
    }

    // Create template
    const templateResult = await query(
      `INSERT INTO finance_schema.obligation_templates 
       (template_name, sections, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.template_name, JSON.stringify(data.sections || []), data.created_by]
    );

    const templateId = templateResult.rows[0].id;

    // Create fields
    const fields: ObligationField[] = [];
    for (const field of data.fields) {
      const fieldResult = await query(
        `INSERT INTO finance_schema.obligation_fields 
         (template_id, field_key, label, field_type, is_mandatory, 
          is_repeatable, order_index, default_value, validation_rules, select_options)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          templateId,
          field.field_key,
          field.label,
          field.field_type,
          field.is_mandatory,
          field.is_repeatable,
          field.order_index,
          field.default_value || null,
          field.validation_rules ? JSON.stringify(field.validation_rules) : null,
          field.select_options ? JSON.stringify(field.select_options) : null,
        ]
      );

      const row = fieldResult.rows[0];
      fields.push({
        id: row.id,
        template_id: row.template_id,
        field_key: row.field_key,
        label: row.label,
        field_type: row.field_type,
        is_mandatory: row.is_mandatory,
        is_repeatable: row.is_repeatable,
        order_index: row.order_index,
        default_value: row.default_value,
        validation_rules: row.validation_rules,
        select_options: row.select_options,
        created_at: row.created_at,
      });
    }

    const template = {
      id: templateResult.rows[0].id,
      template_name: templateResult.rows[0].template_name,
      sections: templateResult.rows[0].sections,
      is_active: templateResult.rows[0].is_active,
      created_by: templateResult.rows[0].created_by,
      created_at: templateResult.rows[0].created_at,
      updated_at: templateResult.rows[0].updated_at,
      fields,
    };

    return template;
  }

  static async getObligationTemplate(templateId: string): Promise<(ObligationTemplate & { fields: ObligationField[] }) | null> {
    const templateResult = await query(
      `SELECT * FROM finance_schema.obligation_templates WHERE id = $1`,
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      return null;
    }

    const template = templateResult.rows[0];

    const fieldsResult = await query(
      `SELECT * FROM finance_schema.obligation_fields 
       WHERE template_id = $1 
       ORDER BY order_index`,
      [templateId]
    );

    const fields: ObligationField[] = fieldsResult.rows.map(row => ({
      id: row.id,
      template_id: row.template_id,
      field_key: row.field_key,
      label: row.label,
      field_type: row.field_type,
      is_mandatory: row.is_mandatory,
      is_repeatable: row.is_repeatable,
      order_index: row.order_index,
      default_value: row.default_value,
      validation_rules: row.validation_rules,
      select_options: row.select_options,
      created_at: row.created_at,
    }));

    return {
      id: template.id,
      template_name: template.template_name,
      sections: template.sections,
      is_active: template.is_active,
      created_by: template.created_by,
      created_at: template.created_at,
      updated_at: template.updated_at,
      fields,
    };
  }

  static async getActiveObligationTemplate(): Promise<(ObligationTemplate & { fields: ObligationField[] }) | null> {
    // Check if table exists first
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'obligation_templates'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      return null;
    }
    
    // Check if is_active column exists
    const columnCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'finance_schema' 
        AND table_name = 'obligation_templates'
        AND column_name = 'is_active'
      )`
    );
    
    const hasIsActive = columnCheck.rows[0].exists;
    
    const templateResult = await query(
      hasIsActive
        ? `SELECT * FROM finance_schema.obligation_templates 
           WHERE is_active = true 
           ORDER BY created_at DESC 
           LIMIT 1`
        : `SELECT * FROM finance_schema.obligation_templates 
           ORDER BY created_at DESC 
           LIMIT 1`,
      []
    );

    if (templateResult.rows.length === 0) {
      return null;
    }

    return this.getObligationTemplate(templateResult.rows[0].id);
  }

  static async getAllObligationTemplates(): Promise<ObligationTemplate[]> {
    const result = await query(
      `SELECT * FROM finance_schema.obligation_templates 
       ORDER BY template_name`,
      []
    );

    return result.rows.map(row => ({
      id: row.id,
      template_name: row.template_name,
      sections: row.sections || [],
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      fields: [], // Fields are not included in list view for performance
    }));
  }

  static async updateObligationTemplate(
    templateId: string,
    data: {
      template_name?: string;
      sections?: string[];
      is_active?: boolean;
      fields?: Array<{
        field_key: string;
        label: string;
        field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
        is_mandatory: boolean;
        is_repeatable: boolean;
        order_index: number;
        default_value?: string;
        validation_rules?: any;
        select_options?: string[];
      }>;
    }
  ): Promise<ObligationTemplate & { fields: ObligationField[] }> {
    // Update template
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.template_name !== undefined) {
      updates.push(`template_name = $${paramCount++}`);
      values.push(data.template_name);
    }
    if (data.sections !== undefined) {
      updates.push(`sections = $${paramCount++}`);
      values.push(JSON.stringify(data.sections));
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }

    if (updates.length > 0) {
      values.push(templateId);
      await query(
        `UPDATE finance_schema.obligation_templates 
         SET ${updates.join(', ')} 
         WHERE id = $${paramCount}`,
        values
      );
    }

    // Update fields if provided
    if (data.fields !== undefined) {
      // Delete existing fields
      await query(
        `DELETE FROM finance_schema.obligation_fields WHERE template_id = $1`,
        [templateId]
      );

      // Insert new fields
      for (const field of data.fields) {
        await query(
          `INSERT INTO finance_schema.obligation_fields 
           (template_id, field_key, label, field_type, is_mandatory, 
            is_repeatable, order_index, default_value, validation_rules, select_options)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            templateId,
            field.field_key,
            field.label,
            field.field_type,
            field.is_mandatory,
            field.is_repeatable,
            field.order_index,
            field.default_value || null,
            field.validation_rules ? JSON.stringify(field.validation_rules) : null,
            field.select_options ? JSON.stringify(field.select_options) : null,
          ]
        );
      }
    }

    const updated = await this.getObligationTemplate(templateId);
    if (!updated) {
      throw new Error('Template not found after update');
    }
    return updated;
  }
}

