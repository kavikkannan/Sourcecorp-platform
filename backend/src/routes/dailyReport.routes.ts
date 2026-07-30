import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { DailyReportController } from '../controllers/dailyReport.controller';
import * as validators from '../validators/dailyReport.validator';

const router = Router();

router.use(authenticateToken);

router.post(
  '/',
  requirePermission('daily_report.create'),
  validate(validators.upsertDailyReportSchema),
  DailyReportController.upsertReport
);

router.get(
  '/',
  requireAnyPermission(['daily_report.view', 'daily_report.view_subordinates']),
  validate(validators.getDailyReportsSchema),
  DailyReportController.getReports
);

router.get(
  '/stats',
  requireAnyPermission(['daily_report.view', 'daily_report.view_subordinates']),
  validate(validators.getDailyReportStatsSchema),
  DailyReportController.getMonthlyStats
);

export default router;
