// ข้อมูลตัวเลือกสำหรับ Form ครุภัณฑ์ ผู้ใช้ที่ Login แล้วอ่านได้ทุก role
import express from 'express';

import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/categories
router.get('/categories', async (_request, response) => {
  try {
    const categories = await prisma.categories.findMany({
      select: {
        category_id: true,
        category_name: true,
        description: true,
      },
      orderBy: { category_name: 'asc' },
    });

    response.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);

    response.status(500).json({
      message: 'ไม่สามารถโหลดหมวดหมู่ได้',
    });
  }
});

// GET /api/locations
router.get('/locations', async (_request, response) => {
  try {
    const locations = await prisma.locations.findMany({
      select: {
        location_id: true,
        location_name: true,
        building: true,
        room: true,
      },
      orderBy: { location_name: 'asc' },
    });

    response.json({ locations });
  } catch (error) {
    console.error('Get locations error:', error);

    response.status(500).json({
      message: 'ไม่สามารถโหลดสถานที่ได้',
    });
  }
});

export default router;
