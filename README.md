# Material and Asset Management System

เว็บแอปพลิเคชันจัดการวัสดุและครุภัณฑ์สำหรับภาควิชาสถิติประยุกต์

## โครงสร้าง

- `client/` — React + Vite สำหรับส่วนติดต่อผู้ใช้
- `server/` — Express API และ Prisma ORM

## เริ่มใช้งาน

1. คัดลอก `server/.env.example` เป็น `server/.env` และกำหนดค่า MySQL
   (สร้างแค่ฐานข้อมูลเปล่าชื่อ `asset_management` ไว้ ตารางจะถูกสร้างในขั้นที่ 3)
2. ติดตั้ง dependencies ด้วย `npm install`
3. สร้างตารางทั้งหมดด้วย `npm --workspace server run prisma:migrate:dev`
4. เปิด API: `npm run dev:server`
5. เปิดเว็บ: `npm run dev:client`

## ฐานข้อมูล

`server/prisma/schema.prisma` เป็นแหล่งความจริงเพียงแห่งเดียวของโครงสร้างฐานข้อมูล
ไฟล์ SQL ที่รันจริงอยู่ใน `server/prisma/migrations/` และ config ของ Prisma CLI อยู่ที่
`server/prisma.config.js` (ประกอบ connection string จากตัวแปร `DB_*` ใน `.env`)

เวลาจะแก้โครงสร้างตาราง ให้แก้ `schema.prisma` แล้วรัน

```powershell
npm --workspace server run prisma:migrate:dev -- --name ชื่อ_migration
```

คำสั่งนี้จะสร้างไฟล์ migration ใหม่พร้อม apply กับฐานข้อมูลในเครื่องให้เลย
ต้อง commit ไฟล์ที่ได้ใน `server/prisma/migrations/` ด้วยเสมอ เพราะ production
รัน `prisma migrate deploy` จากไฟล์เหล่านี้อัตโนมัติตอน deploy

อย่าแก้โครงสร้างด้วยการรัน SQL มือ เพราะจะทำให้ฐานข้อมูลหลุดจาก `schema.prisma`
แล้ว Prisma จะ error `P2022 ColumnNotFound` ตอน query

> ห้าม commit ไฟล์ `.env` เพราะมีรหัสผ่านฐานข้อมูล

## อ่านโค้ดต่อจากตรงไหน

เปิด [`docs/PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md) เพื่อดูภาพรวมระบบ ลำดับไฟล์ที่ควรอ่าน และตัวอย่างเส้นทางการทำงานของ Login/ครุภัณฑ์

การสร้าง QR Code และการทดสอบจากโทรศัพท์ดูได้ที่ [`docs/QR_GUIDE.md`](docs/QR_GUIDE.md)
