# Material and Asset Management System

เว็บแอปพลิเคชันจัดการวัสดุและครุภัณฑ์สำหรับภาควิชาสถิติประยุกต์

## โครงสร้าง

- `client/` — React + Vite สำหรับส่วนติดต่อผู้ใช้
- `server/` — Express API
- `database/` — MySQL schema และข้อมูลตัวอย่าง

## เริ่มใช้งาน

1. คัดลอก `server/.env.example` เป็น `server/.env` และกำหนดค่า MySQL
2. สร้างฐานข้อมูลด้วย `database/schema.sql`
3. ติดตั้ง dependencies ด้วย `npm install`
4. เปิด API: `npm run dev:server`
5. เปิดเว็บ: `npm run dev:client`

> ห้าม commit ไฟล์ `.env` เพราะมีรหัสผ่านฐานข้อมูล
