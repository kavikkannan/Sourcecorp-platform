import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createCAMTemplateSchema,
  updateCAMTemplateSchema,
  getCAMTemplateSchema,
  createObligationTemplateSchema,
  updateObligationTemplateSchema,
  getObligationTemplateSchema,
} from '../validators/template.validator';

const router = Router();

// All routes require authentication and template management permission
router.use(authenticateToken);
router.use(requirePermission('finance.template.manage'));

// CAM Template routes
router.post(
  '/cam',
  validate(createCAMTemplateSchema),
  TemplateController.createCAMTemplate
);

router.get(
  '/cam',
  TemplateController.getAllCAMTemplates
);

router.get(
  '/cam/:id',
  validate(getCAMTemplateSchema),
  TemplateController.getCAMTemplate
);

router.get(
  '/cam/loan-type/:loanType',
  validate(getCAMTemplateSchema),
  TemplateController.getCAMTemplate
);

router.put(
  '/cam/:id',
  validate(updateCAMTemplateSchema),
  TemplateController.updateCAMTemplate
);

// Obligation Template routes
router.post(
  '/obligation',
  validate(createObligationTemplateSchema),
  TemplateController.createObligationTemplate
);

router.get(
  '/obligation',
  TemplateController.getAllObligationTemplates
);

router.get(
  '/obligation/:id?',
  validate(getObligationTemplateSchema),
  TemplateController.getObligationTemplate
);

router.put(
  '/obligation/:id',
  validate(updateObligationTemplateSchema),
  TemplateController.updateObligationTemplate
);

export default router;

