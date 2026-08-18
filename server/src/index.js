// จุดเริ่มต้นของ Backend: ตั้งค่า Express และประกอบ route จากแต่ละโมดูล
import cors from 'cors';
import express from 'express';

import { clientOrigins, port } from './config.js';
import { pool } from './db.js';
import adminUserRoutes from './routes/admin-users.routes.js';
import authRoutes from './routes/auth.routes.js';
import equipmentRoutes, {
  adminEquipmentRouter,
} from './routes/equipment.routes.js';
import optionRoutes from './routes/options.routes.js';

const app = express();

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
    const [rows] = await pool.query(`
      SELECT
        DATABASE() AS database_name,
        VERSION() AS version
    `);

    response.json({
      status: 'ok',
      database: rows[0],
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

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
