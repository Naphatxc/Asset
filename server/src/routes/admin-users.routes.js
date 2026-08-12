// ทุก route ในไฟล์นี้สงวนให้ Admin สำหรับจัดการบัญชีผู้ใช้
import express from 'express';

import { pool } from '../db.js';
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
    const [users] = await pool.query(
      `SELECT
        user_id,
        name,
        email,
        role,
        created_at
      FROM users
      ORDER BY created_at DESC`,
    );

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

    const [users] = await pool.execute(
      `SELECT user_id, name, email, role
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    const user = users[0];

    if (!user) {
      return response.status(404).json({
        message: 'ไม่พบผู้ใช้',
      });
    }

    await pool.execute(
      `UPDATE users
       SET role = ?
       WHERE user_id = ?`,
      [role, userId],
    );

    response.json({
      message: 'อัปเดตสิทธิ์เรียบร้อยแล้ว',
      user: {
        ...user,
        role,
      },
    });
  } catch (error) {
    console.error('Update role error:', error);

    response.status(500).json({
      message: 'ไม่สามารถอัปเดตสิทธิ์ได้',
    });
  }
});

export default router;
