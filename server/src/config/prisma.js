// Prisma Client เป็นจุดเชื่อมฐานข้อมูลกลางของทั้ง Backend
import 'dotenv/config.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { isProduction } from './env.js';

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'asset_management',
  connectionLimit: 10,
  connectTimeout: 5_000,
  idleTimeout: 300,
  // MySQL 8 (เครื่อง dev ในเน็ตเวิร์กบ้าน/ออฟฟิศ) ใช้ caching_sha2_password เป็นค่าเริ่มต้น ซึ่งต้องขอ RSA
  // public key จาก server ตอน auth ถ้าไม่ได้เชื่อมด้วย TLS — ปิดไว้เฉพาะ dev พอ (ไม่มีความเสี่ยง MITM
  // ในเครื่อง/วง LAN ของตัวเอง) production ไม่เปิดเพราะยังไม่เจอปัญหานี้ และไม่อยากเปลี่ยนพฤติกรรมโดยไม่จำเป็น
  allowPublicKeyRetrieval: !isProduction,
});

// ใช้ instance เดียว ป้องกันการสร้าง connection pool ซ้ำทุก request
export const prisma = new PrismaClient({ adapter });
