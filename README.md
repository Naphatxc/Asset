# Material and Asset Management System

เว็บแอปพลิเคชันจัดการวัสดุและครุภัณฑ์สำหรับภาควิชาสถิติประยุกต์

## โครงสร้าง

- `client/` — React + Vite สำหรับส่วนติดต่อผู้ใช้
- `server/` — Express API และ Prisma ORM
- `database/` — MySQL schema และข้อมูลตัวอย่าง

## เริ่มใช้งาน

1. คัดลอก `server/.env.example` เป็น `server/.env` และกำหนดค่า MySQL
2. สร้างฐานข้อมูลด้วย `database/schema.sql`
3. ติดตั้ง dependencies ด้วย `npm install`
4. ดึง schema จากฐานข้อมูลเดิมด้วย `npm --workspace server run prisma:pull`
5. Generate Prisma Client ด้วย `npm --workspace server run prisma:generate`
6. เปิด API: `npm run dev:server`
7. เปิดเว็บ: `npm run dev:client`

Backend ใช้ Prisma Client สำหรับอ่านและเขียนข้อมูลทั้งหมด โดย schema อยู่ที่
`server/prisma/schema.prisma` และ config อยู่ที่ `server/prisma.config.js`

> ห้าม commit ไฟล์ `.env` เพราะมีรหัสผ่านฐานข้อมูล

## อ่านโค้ดต่อจากตรงไหน

เปิด [`docs/PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md) เพื่อดูภาพรวมระบบ ลำดับไฟล์ที่ควรอ่าน และตัวอย่างเส้นทางการทำงานของ Login/ครุภัณฑ์

การสร้าง QR Code และการทดสอบจากโทรศัพท์ดูได้ที่ [`docs/QR_GUIDE.md`](docs/QR_GUIDE.md)
