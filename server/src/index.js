// จุดเริ่มต้นของ Backend: ตั้งค่า Express และประกอบ route จากแต่ละโมดูล
import cors from 'cors';
import express from 'express';

import { clientOrigins, port } from './config.js';
import { prisma } from './db.js';
import adminUserRoutes from './routes/admin-users.routes.js';
import authRoutes from './routes/auth.routes.js';
import equipmentRoutes, {
  adminEquipmentRouter,
} from './routes/equipment.routes.js';
import optionRoutes from './routes/options.routes.js';

export const app = express();

// อนุญาตเฉพาะ Frontend URL ที่กำหนด และแปลง JSON body ให้ request.body
app.use(cors({ origin: clientOrigins }));
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'asset-management-api',
  });
});

// Endpoint นี้ใช้ตรวจว่า Server เชื่อมฐานข้อมูลตัวที่ตั้งค่าไว้ได้จริง
app.get('/api/db-check', async (_request, response) => {
  try {
    // Query ผ่าน Prisma เพื่อยืนยันว่า connection และ schema ใช้งานได้จริง
    await prisma.users.count();

    response.json({
      status: 'ok',
      database: {
        database_name: process.env.DB_NAME ?? 'asset_management',
        orm: 'Prisma',
      },
    });
  } catch (error) {
    console.error('Database connection error:', error);

    response.status(500).json({
      status: 'error',
      message: 'Database connection failed',
    });
  }
});

// Prefix ด้านซ้ายจะถูกต่อกับ path ภายในไฟล์ route ด้านขวา
app.use('/api/auth', authRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/equipment-items', equipmentRoutes);
app.use('/api/admin/equipment-items', adminEquipmentRouter);
app.use('/api', optionRoutes);

export const server = app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});

function shutdown() {
  server.close(async (error) => {
    await prisma.$disconnect();

    if (error) {
      console.error('Server shutdown error:', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
