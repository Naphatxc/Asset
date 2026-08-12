// Connection Pool เปิด connection ซ้ำได้โดยไม่ต้องเชื่อม MySQL ใหม่ทุก request
import 'dotenv/config.js';
import mysql from 'mysql2/promise';


export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // ให้ DATE/DATETIME เป็น string ป้องกันวันที่ถอยหนึ่งวันจากการแปลง timezone
  dateStrings: true,
});
