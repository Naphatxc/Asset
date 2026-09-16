// รวม Route ทุกโมดูล mount ใต้ /api ตาม path เดิมของระบบ (ดู app.js)
import express from 'express';

import adminUserRoutes from '../modules/users/admin-users.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import borrowRoutes, {
  adminBorrowRouter,
} from '../modules/borrow/borrow.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import equipmentRoutes, {
  adminEquipmentRouter,
} from '../modules/equipment/equipment.routes.js';
import healthRoutes from '../modules/health/health.routes.js';
import optionRoutes from '../modules/options/options.routes.js';

const router = express.Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin/users', adminUserRoutes);
router.use('/equipment-items', equipmentRoutes);
router.use('/admin/equipment-items', adminEquipmentRouter);
router.use('/borrows', borrowRoutes);
router.use('/admin/borrows', adminBorrowRouter);
router.use('/admin/dashboard', dashboardRoutes);
router.use('/', optionRoutes);

export default router;
