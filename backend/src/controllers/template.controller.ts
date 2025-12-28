import { Response } from 'express';
import { AuthRequest } from '../types';
import { TemplateService } from '../services/template.service';
import { AuditService } from '../services/audit.service';

export class TemplateController {
  
  // ============================================
  // CAM TEMPLATE MANAGEMENT
  // ============================================

  static async createCAMTemplate(req: AuthRequest, res: Response) {
    try {
      const { loan_type, template_name, sections, fields } = req.body;

      const template = await TemplateService.createCAMTemplate({
        loan_type,
        template_name,
        sections,
        fields,
        created_by: req.user!.userId,
      });

      // Audit log
      await AuditService.createLog({
        userId: req.user!.userId,
        action: 'finance.template.cam.create',
        resourceType: 'cam_template',
        resourceId: template.id,
        details: {
          loan_type,
          template_name,
          field_count: fields.length,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(template);
    } catch (error: any) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return res.status(409).json({ error: 'Template with this name already exists for this loan type' });
      }
      throw error;
    }
  }

  static async getCAMTemplate(req: AuthRequest, res: Response) {
    try {
      const { id, loanType } = req.params;

      let template;
      if (id) {
        template = await TemplateService.getCAMTemplate(id);
      } else if (loanType) {
        template = await TemplateService.getCAMTemplateByLoanType(loanType);
      } else {
        return res.status(400).json({ error: 'Either id or loanType must be provided' });
      }

      if (!template) {
        return res.status(404).json({ error: 'CAM template not found' });
      }

      res.json(template);
    } catch (error) {
      throw error;
    }
  }

  static async getAllCAMTemplates(req: AuthRequest, res: Response) {
    try {
      const templates = await TemplateService.getAllCAMTemplates();
      res.json(templates);
    } catch (error) {
      throw error;
    }
  }

  static async updateCAMTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { template_name, sections, is_active, fields } = req.body;

      const template = await TemplateService.updateCAMTemplate(id, {
        template_name,
        sections,
        is_active,
        fields,
      });

      // Audit log
      await AuditService.createLog({
        userId: req.user!.userId,
        action: 'finance.template.cam.update',
        resourceType: 'cam_template',
        resourceId: id,
        details: {
          template_name,
          is_active,
          field_count: fields?.length,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(template);
    } catch (error: any) {
      if (error.message === 'Template not found after update') {
        return res.status(404).json({ error: 'CAM template not found' });
      }
      throw error;
    }
  }

  // ============================================
  // OBLIGATION TEMPLATE MANAGEMENT
  // ============================================

  static async createObligationTemplate(req: AuthRequest, res: Response) {
    try {
      const { template_name, sections, fields } = req.body;

      // Validate required fields
      if (!template_name) {
        return res.status(400).json({ error: 'Template name is required' });
      }
      if (!sections || !Array.isArray(sections)) {
        return res.status(400).json({ error: 'Sections must be an array' });
      }
      if (!fields || !Array.isArray(fields)) {
        return res.status(400).json({ error: 'Fields must be an array' });
      }

      const template = await TemplateService.createObligationTemplate({
        template_name,
        sections: sections || [],
        fields: fields || [],
        created_by: req.user!.userId,
      });

      // Audit log
      await AuditService.createLog({
        userId: req.user!.userId,
        action: 'finance.template.obligation.create',
        resourceType: 'obligation_template',
        resourceId: template.id,
        details: {
          template_name,
          field_count: fields?.length || 0,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(template);
    } catch (error: any) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return res.status(409).json({ error: 'Template with this name already exists' });
      }
      throw error;
    }
  }

  static async getObligationTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      let template;
      if (id) {
        template = await TemplateService.getObligationTemplate(id);
      } else {
        template = await TemplateService.getActiveObligationTemplate();
      }

      if (!template) {
        return res.status(404).json({ error: 'Obligation template not found' });
      }

      res.json(template);
    } catch (error) {
      throw error;
    }
  }

  static async getAllObligationTemplates(req: AuthRequest, res: Response) {
    try {
      const templates = await TemplateService.getAllObligationTemplates();
      res.json(templates);
    } catch (error) {
      throw error;
    }
  }

  static async updateObligationTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { template_name, sections, is_active, fields } = req.body;

      const template = await TemplateService.updateObligationTemplate(id, {
        template_name,
        sections,
        is_active,
        fields,
      });

      // Audit log
      await AuditService.createLog({
        userId: req.user!.userId,
        action: 'finance.template.obligation.update',
        resourceType: 'obligation_template',
        resourceId: id,
        details: {
          template_name,
          is_active,
          field_count: fields?.length,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(template);
    } catch (error: any) {
      if (error.message === 'Template not found after update') {
        return res.status(404).json({ error: 'Obligation template not found' });
      }
      throw error;
    }
  }
}

