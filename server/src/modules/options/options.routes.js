// ข้อมูลตัวเลือกสำหรับ Form ครุภัณฑ์ ผู้ใช้ที่ Login แล้วอ่านได้ทุก role
import express from 'express';

import * as optionsController from './options.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

// GET /api/categories
router.get('/categories', optionsController.getCategories);

// GET /api/locations
router.get('/locations', optionsController.getLocations);

export default router;
