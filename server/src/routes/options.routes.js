// ข้อมูลตัวเลือกสำหรับ Form ครุภัณฑ์ ผู้ใช้ที่ Login แล้วอ่านได้ทุก role
import express from 'express';

import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// GET /api/categories
router.get('/categories', async (_request, response) => {
  try {
    const [categories] = await pool.query(
      `SELECT
        category_id,
        category_name,
        description
      FROM categories
      ORDER BY category_name`,
    );

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
    const [locations] = await pool.query(
      `SELECT
        location_id,
        location_name,
        building,
        room
      FROM locations
      ORDER BY location_name`,
    );

    response.json({ locations });
  } catch (error) {
    console.error('Get locations error:', error);

    response.status(500).json({
      message: 'ไม่สามารถโหลดสถานที่ได้',
    });
  }
});

export default router;
