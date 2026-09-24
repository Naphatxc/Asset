// สรุปข้อมูลภาพรวมสำหรับหน้า Dashboard สงวนให้ Admin เท่านั้น (ข้อมูลรวมทุกผู้ใช้ในระบบ)
import express from 'express';

import * as dashboardController from './dashboard.controller.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/dashboard/summary
router.get('/summary', dashboardController.getDashboardSummary);

export default router;
