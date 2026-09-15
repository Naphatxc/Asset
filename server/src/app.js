// ประกอบ Express app: middleware กลาง + mount routes ทั้งหมดใต้ /api + error handler
import cors from 'cors';
import express from 'express';

import { clientOrigins } from './config/env.js';
import { errorHandler } from './middlewares/error.middleware.js';
import routes from './routes/index.js';
import { AppError } from './utils/AppError.js';

export const app = express();

// อนุญาตเฉพาะ Frontend URL ที่กำหนด และแปลง JSON body ให้ request.body
app.use(cors({ origin: clientOrigins }));
app.use(express.json());

app.use('/api', routes);

// path ที่ไม่ตรง route ไหนเลย ให้ตอบ JSON แบบเดียวกับ error อื่นในระบบ แทน HTML default ของ Express
app.use((request, _response, next) => {
  next(new AppError(404, 'ไม่พบเส้นทางที่ร้องขอ'));
});

// ต้องอยู่หลัง route ทั้งหมดเสมอ เพื่อรับ error ที่ถูกส่งผ่าน next(error)
app.use(errorHandler);
