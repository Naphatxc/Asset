// ทุก route ในไฟล์นี้สงวนให้ Admin สำหรับจัดการบัญชีผู้ใช้
import express from 'express';

import { prisma } from '../db.js';
import {
  authenticate,
  requireAdmin,
} from '../middleware/auth.js';

const router = express.Router();

// ใช้ middleware กับทั้ง router จึงไม่ต้องเขียนซ้ำทุก endpoint
router.use(authenticate, requireAdmin);

// GET /api/admin/users
router.get('/', async (_request, response) => {
  try {
    const users = await prisma.users.findMany({
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    response.json({ users });
  } catch (error) {
    console.error('Get users error:', error);

    response.status(500).json({
      message: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้',
    });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/:id/role', async (request, response) => {
  try {
    const userId = Number(request.params.id);
    const role = String(request.body?.role ?? '')
      .trim()
      .toLowerCase();

    if (!Number.isInteger(userId) || userId <= 0) {
      return response.status(400).json({
        message: 'รหัสผู้ใช้ไม่ถูกต้อง',
      });
    }

    if (!['admin', 'user'].includes(role)) {
      return response.status(400).json({
        message: 'Role ต้องเป็น admin หรือ user',
      });
    }

    if (
      String(request.user.sub) === String(userId) &&
      role !== 'admin'
    ) {
      // ป้องกัน Admin ลดสิทธิ์บัญชีตัวเองจนจัดการระบบต่อไม่ได้
      return response.status(400).json({
        message: 'ไม่สามารถลดสิทธิ์บัญชีที่กำลังใช้งานได้',
      });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return response.status(404).json({
        message: 'ไม่พบผู้ใช้',
      });
    }

    const updatedUser = await prisma.users.update({
      where: { user_id: userId },
      data: { role },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    response.json({
      message: 'อัปเดตสิทธิ์เรียบร้อยแล้ว',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update role error:', error);

    response.status(500).json({
      message: 'ไม่สามารถอัปเดตสิทธิ์ได้',
    });
  }
});

export default router;
