# คู่มืออ่านโค้ดโปรเจกต์ Asset Management

เอกสารนี้เป็นแผนที่สำหรับอ่านโค้ด ไม่จำเป็นต้องอ่านทุกไฟล์พร้อมกัน

## ภาพรวมการทำงาน

```text
Browser (React + TanStack Query)
  -> axios ที่ตั้ง withCredentials (แนบ cookie access_token อัตโนมัติ)
  -> request ที่เปลี่ยนข้อมูลแนบ header X-CSRF-Token ด้วย
Express Route
  -> authenticate (อ่าน JWT จาก cookie)
  -> verifyCsrfToken + requireAdmin (เฉพาะงาน Admin)
  -> Controller -> Service -> Repository
  -> Prisma Client
MySQL
  -> ส่งผลกลับเป็น JSON
React
  -> TanStack Query อัปเดต cache แล้ว render หน้าจอใหม่
```

Token ไม่ได้เก็บใน `localStorage` แต่เป็น httpOnly cookie ที่ JavaScript อ่านไม่ได้
กัน XSS ขโมย token ไปใช้ตรง ๆ ส่วน CSRF ใช้รูปแบบ double-submit cookie
(ดู `server/src/utils/csrf.js` และ `client/src/api/http.js`)

## ลำดับอ่าน Frontend

1. `client/src/main.jsx` — จุดเริ่ม React, QueryClientProvider และ ToastProvider
2. `client/src/App.jsx` — Routing, Session และ role ของผู้ใช้
3. `client/src/api/http.js` — axios instance กลาง, CSRF header และ ApiError
4. `client/src/pages/LoginPage/LoginPage.jsx` — ฟอร์ม Login/Register
5. `client/src/pages/Dashboard/Dashboard.jsx` — โครงหน้าหลัง Login และแท็บต่าง ๆ
6. `client/src/pages/Dashboard/components/EquipmentManager.jsx` — สมองของหน้าครุภัณฑ์
7. `client/src/api/equipment.js` — ทุก HTTP request ของครุภัณฑ์
8. `client/src/components/EquipmentForm.jsx` — แปลงข้อมูลระหว่าง input กับ API payload
9. `client/src/pages/Dashboard/components/EquipmentTable.jsx` — ตารางและปุ่มของแต่ละแถว
10. `client/src/pages/EquipmentDetailPage/EquipmentDetailPage.jsx` — หน้าที่เปิดจาก URL ใน QR
11. `client/src/components/QrCodeDialog.jsx` — สร้าง ดาวน์โหลด และพิมพ์ QR
12. `client/src/pages/Dashboard/components/EquipmentHistory.jsx` — แสดง Audit Log
13. `client/src/styles.css` — สีและ Layout

แนวคิดสำคัญ: Component ที่แสดงผลไม่ควรเข้าถึงฐานข้อมูล และ Backend ไม่ควรรู้เรื่อง HTML

การใช้ TanStack Query ในโปรเจกต์นี้อธิบายไว้ใน `docs/TANSTACK_QUERY.md`

## ลำดับอ่าน Backend

1. `server/src/server.js` — เปิด HTTP server และจัดการ shutdown
2. `server/src/app.js` — ประกอบ Express, CORS, cookie parser และ error handler
3. `server/src/routes/index.js` — รวม route ทุกโมดูลไว้ใต้ `/api`
4. `server/src/config/env.js` — อ่านค่าจาก `.env` และตั้งค่า cookie
5. `server/src/config/prisma.js` — Prisma Client และ MariaDB driver adapter
6. `server/src/middlewares/auth.middleware.js` — ตรวจ Token และ role
7. `server/src/middlewares/csrf.middleware.js` — ตรวจ header X-CSRF-Token
8. `server/src/middlewares/error.middleware.js` — จุดเดียวที่แปลง error เป็น HTTP response
9. `server/src/modules/auth/` — Register/Login/Me/Logout
10. `server/src/modules/equipment/` — CRUD, Status, Soft Delete, Restore
11. `server/prisma/schema.prisma` — Models, relations และ enums ของฐานข้อมูล

### โครงสร้างของแต่ละโมดูล

ทุกโฟลเดอร์ใน `server/src/modules/` ใช้รูปแบบเดียวกัน

| ไฟล์ | หน้าที่ |
|---|---|
| `*.routes.js` | ผูก path กับ middleware และ controller |
| `*.validator.js` | ตรวจและแปลง input ใส่ไว้ที่ `request.validated` |
| `*.controller.js` | อ่าน request เรียก service แล้วตอบ response |
| `*.service.js` | Business logic และการโยน `AppError` |
| `*.repository.js` | คุยกับ Prisma ที่เดียว ไม่ให้ query กระจาย |

## Request ที่ควรไล่อ่านเป็นตัวอย่าง

### Login

```text
LoginPage -> api/auth.js
-> POST /api/auth/login
-> auth.routes.js -> validateLogin -> auth.controller.js
-> auth.service.js -> bcrypt.compare() -> jwt.sign()
-> controller set cookie access_token (httpOnly) + csrf_token
-> ส่ง csrfToken กลับทาง response body ด้วย
-> client เก็บ csrfToken ไว้ในหน่วยความจำให้ interceptor ใช้
```

ที่ต้องส่ง `csrfToken` กลับทาง body เพราะ production client กับ server อยู่คนละ host
หน้าเว็บจึงอ่าน cookie ของ server ข้าม origin ไม่ได้

### แก้ไขครุภัณฑ์

```text
EquipmentForm -> EquipmentManager -> api/equipment.js
-> PATCH /api/admin/equipment-items/:id
-> authenticate -> verifyCsrfToken -> requireAdmin
-> equipment.controller.js -> equipment.service.js
-> prisma.$transaction()
-> equipment.repository.js (update equipment + equipment_items)
-> equipment-history.repository.js (บันทึก Audit Log)
-> transaction commit
-> TanStack Query invalidate แล้วโหลดตารางใหม่
```

### Soft Delete

การลบไม่ได้ใช้ `DELETE FROM equipment_items` แต่ใส่วันที่ลง `deleted_at` ข้อมูลจึงยังกู้คืนและตรวจสอบประวัติได้ วัสดุใน `materials` ก็ใช้วิธีเดียวกัน

### เปิดครุภัณฑ์จาก QR

```text
QR -> /equipment/:code
-> App ตรวจ Session
-> EquipmentDetailPage
-> GET /api/equipment-items/:code
-> User ดูรายละเอียด / Admin แก้ไขหรือพิมพ์ QR
```

อ่านวิธีตั้งค่าโทรศัพท์ต่อได้ใน `docs/QR_GUIDE.md`

## การแก้โครงสร้างฐานข้อมูล

`server/prisma/schema.prisma` เป็นแหล่งความจริงเพียงแห่งเดียว ไม่มีไฟล์ SQL ให้รันมืออีกแล้ว

```powershell
npm --workspace server run prisma:migrate:dev -- --name ชื่อ_migration
```

คำสั่งนี้สร้างไฟล์ใน `server/prisma/migrations/` พร้อม apply กับฐานข้อมูลในเครื่อง
ต้อง commit ไฟล์นั้นด้วย เพราะ Railway รัน `prisma migrate deploy` จากไฟล์เหล่านี้
อัตโนมัติผ่าน pre-deploy step ตอน deploy

`0_init` คือ baseline ที่สะท้อนโครงสร้าง ณ ตอนย้ายมาใช้ Prisma Migrate
มี `chk_material_quantity` เขียนเพิ่มไว้เองเพราะ Prisma ยังไม่รองรับ check constraint

เช็คว่าฐานข้อมูลตรงกับ schema หรือยัง

```powershell
npm --workspace server run prisma:migrate:status
```

## คำศัพท์ในโค้ด

- `state` — ข้อมูลในหน่วยความจำของหน้า React เมื่อเปลี่ยนแล้วหน้าจะ render ใหม่
- `props` — ข้อมูลหรือฟังก์ชันที่ Component แม่ส่งให้ Component ลูก
- `middleware` — ฟังก์ชันที่ทำงานก่อน route เช่น ตรวจ Token
- `Prisma Model` — ตัวแทนตารางและความสัมพันธ์ที่ประกาศใน `schema.prisma`
- `Prisma Client` — API สำหรับอ่าน/เขียน MySQL โดยไม่ต้องต่อ string SQL เอง
- `migration` — ไฟล์ SQL ที่ Prisma สร้างจากส่วนต่างของ `schema.prisma`
- `transaction` — ชุดคำสั่งฐานข้อมูลที่ต้องสำเร็จทั้งหมด ไม่เช่นนั้น Prisma rollback
- `Soft Delete` — ซ่อนข้อมูลด้วย `deleted_at` แทนการลบแถวจริง
- `Audit Log` — ประวัติว่าใครเปลี่ยนอะไร เมื่อใด และข้อมูลก่อน/หลังคืออะไร
- `CSRF` — การหลอกให้ browser ยิง request แทนผู้ใช้ กันด้วย double-submit cookie
- `HTTP 401` — ยังไม่ได้ Login หรือ Token ใช้ไม่ได้
- `HTTP 403` — Login แล้วแต่ไม่มีสิทธิ์ หรือ CSRF token ไม่ตรง
- `HTTP 409` — ข้อมูลชนกัน เช่น equipment_code ซ้ำ

## คำสั่งเปิดระบบ

Terminal 1:

```powershell
npm run dev:server
```

Terminal 2:

```powershell
npm run dev:client
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3000`
