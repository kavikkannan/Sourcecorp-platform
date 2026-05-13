import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createCAMTemplateSchema,
  updateCAMTemplateSchema,
  getCAMTemplateSchema,
  deleteCAMTemplateSchema,
  createObligationTemplateSchema,
  updateObligationTemplateSchema,
  getObligationTemplateSchema,
  deleteObligationTemplateSchema,
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

router.delete(
  '/cam/:id',
  validate(deleteCAMTemplateSchema),
  TemplateController.deleteCAMTemplate
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
  '/obligation/:id',
  validate(getObligationTemplateSchema),
  TemplateController.getObligationTemplate
);

router.put(
  '/obligation/:id',
  validate(updateObligationTemplateSchema),
  TemplateController.updateObligationTemplate
);

router.delete(
  '/obligation/:id',
  validate(deleteObligationTemplateSchema),
  TemplateController.deleteObligationTemplate
);

export default router;

