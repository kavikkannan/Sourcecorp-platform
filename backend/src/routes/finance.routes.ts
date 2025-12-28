import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { FinanceController } from '../controllers/finance.controller';
import * as validators from '../validators/finance.validator';

const router = Router();

// All finance routes require authentication
router.use(authenticateToken);

// ============================================
// ELIGIBILITY
// ============================================

// Calculate eligibility
router.post(
  '/eligibility/calculate',
  requirePermission('finance.eligibility.calculate'),
  validate(validators.calculateEligibilitySchema),
  FinanceController.calculateEligibility
);

// Get eligibility by case ID
router.get(
  '/eligibility/:caseId',
  requirePermission('finance.eligibility.view'),
  validate(validators.getEligibilitySchema),
  FinanceController.getEligibility
);

// ============================================
// OBLIGATION
// ============================================

// Get active obligation template (for users to see what fields are required)
router.get(
  '/obligation/template',
  requirePermission('finance.obligation.create'),
  async (req, res, next) => {
    try {
      const { TemplateService } = await import('../services/template.service');
      const template = await TemplateService.getActiveObligationTemplate();
      if (!template) {
        return res.status(404).json({ error: 'Active obligation template not found' });
      }
      res.json(template);
    } catch (error) {
      next(error);
    }
  }
);

// Create or update obligation sheet
router.post(
  '/obligation',
  requirePermission('finance.obligation.create'),
  validate(validators.createObligationSheetSchema),
  FinanceController.createObligationSheet
);

// Get obligation sheet by case ID
router.get(
  '/obligation/:caseId',
  requirePermission('finance.obligation.view'),
  validate(validators.getObligationSchema),
  FinanceController.getObligationSheet
);

// ============================================
// CAM
// ============================================

// Get CAM template by loan type (for users to see what fields are required)
router.get(
  '/cam/template/:loanType',
  requirePermission('finance.cam.create'),
  async (req, res, next) => {
    try {
      const { TemplateService } = await import('../services/template.service');
      const template = await TemplateService.getCAMTemplateByLoanType(req.params.loanType);
      if (!template) {
        return res.status(404).json({ error: 'CAM template not found for this loan type' });
      }
      res.json(template);
    } catch (error) {
      next(error);
    }
  }
);

// Create CAM entry
router.post(
  '/cam',
  requirePermission('finance.cam.create'),
  validate(validators.createCAMEntrySchema),
  FinanceController.createCAMEntry
);

// Get CAM entry by case ID
router.get(
  '/cam/:caseId',
  requirePermission('finance.cam.view'),
  validate(validators.getCAMSchema),
  FinanceController.getCAMEntry
);

// ============================================
// EXPORTS
// ============================================

// Export eligibility
router.get(
  '/export/eligibility/:caseId',
  requirePermission('finance.export'),
  validate(validators.exportSchema),
  FinanceController.exportEligibility
);

// Export obligation
router.get(
  '/export/obligation/:caseId',
  requirePermission('finance.export'),
  validate(validators.exportSchema),
  FinanceController.exportObligation
);

// Export CAM
router.get(
  '/export/cam/:caseId',
  requirePermission('finance.export'),
  validate(validators.exportSchema),
  FinanceController.exportCAM
);

export default router;

