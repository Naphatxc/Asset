// Prisma Client เป็นจุดเชื่อมฐานข้อมูลกลางของทั้ง Backend
import 'dotenv/config.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'asset_management',
  connectionLimit: 10,
  connectTimeout: 5_000,
  idleTimeout: 300,
});

// ใช้ instance เดียว ป้องกันการสร้าง connection pool ซ้ำทุก request
export const prisma = new PrismaClient({ adapter });
