// ประกอบ Express app: middleware กลาง + mount routes ทั้งหมดใต้ /api + error handler
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { clientOrigins } from './config/env.js';
import { errorHandler } from './middlewares/error.middleware.js';
import routes from './routes/index.js';
import { AppError } from './utils/AppError.js';

export const app = express();

// credentials: true จำเป็นเพื่อให้ browser แนบ/รับ cookie ข้าม origin (client :5173, server :3000)
// cors ที่ credentials:true ใช้ origin แบบ wildcard '*' ไม่ได้ จึงต้องระบุ origin ที่อนุญาตจริงเสมอ
app.use(cors({ origin: clientOrigins, credentials: true }));
// ห้าม browser เดาชนิดไฟล์เองจากเนื้อหา — ไฟล์ที่ผู้ใช้อัปโหลด (รูป/ไฟล์แนบแจ้งซ่อม) ต้องถูกตีความตาม Content-Type ที่ส่งไปเท่านั้น
app.use((_request, response, next) => {
  response.set('X-Content-Type-Options', 'nosniff');
  next();
});
// ไฟล์นำเข้าครุภัณฑ์/วัสดุหลายร้อยรายการใหญ่เกินเพดาน 100kb ปกติ ให้สอง path นี้รับได้ถึง 10mb
// ต้องอยู่ก่อน express.json() ตัวหลัก (ตัวหลักจะข้าม request ที่ถูก parse ไปแล้ว)
app.use(
  ['/api/admin/equipment-items/import', '/api/admin/materials/import'],
  express.json({ limit: '10mb' }),
);
app.use(express.json());
app.use(cookieParser());

app.use('/api', routes);

// path ที่ไม่ตรง route ไหนเลย ให้ตอบ JSON แบบเดียวกับ error อื่นในระบบ แทน HTML default ของ Express
app.use((request, _response, next) => {
  next(new AppError(404, 'ไม่พบเส้นทางที่ร้องขอ'));
});

// ต้องอยู่หลัง route ทั้งหมดเสมอ เพื่อรับ error ที่ถูกส่งผ่าน next(error)
app.use(errorHandler);
