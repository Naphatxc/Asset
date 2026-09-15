# คู่มืออ่านโค้ดโปรเจกต์ Asset Management

เอกสารนี้เป็นแผนที่สำหรับอ่านโค้ด ไม่จำเป็นต้องอ่านทุกไฟล์พร้อมกัน

## ภาพรวมการทำงาน

```text
Browser (React)
  -> fetch พร้อม Bearer Token
Express Route
  -> authenticate
  -> requireAdmin (เฉพาะงาน Admin)
  -> Prisma Client
MySQL
  -> ส่งผลกลับเป็น JSON
React
  -> เปลี่ยน state และ render หน้าจอใหม่
```

## ลำดับอ่าน Frontend

1. `client/src/main.jsx` — จุดเริ่ม React
2. `client/src/App.jsx` — Login, Register, Session และ role ของผู้ใช้
3. `client/src/components/Dashboard.jsx` — โครงหน้าหลัง Login
4. `client/src/components/EquipmentManager.jsx` — สมองของหน้าครุภัณฑ์
5. `client/src/api/equipment.js` — ทุก HTTP request ของครุภัณฑ์
6. `EquipmentForm.jsx` — แปลงข้อมูลระหว่าง input กับ API payload
7. `EquipmentTable.jsx` — ตารางและปุ่มของแต่ละแถว
8. `EquipmentDetailPage.jsx` — หน้าที่เปิดจาก URL ใน QR และสิทธิ์แก้ไขของ Admin
9. `QrCodeDialog.jsx` — สร้าง ดาวน์โหลด และพิมพ์ QR
10. `EquipmentHistory.jsx` — แสดง Audit Log
11. `styles.css` — สีและ Layout

แนวคิดสำคัญ: Component ที่แสดงผลไม่ควรเข้าถึงฐานข้อมูล และ Backend ไม่ควรรู้เรื่อง HTML

## ลำดับอ่าน Backend

1. `server/src/index.js` — ประกอบ Express และ route prefixes
2. `server/src/config.js` — อ่านค่าจาก `.env`
3. `server/prisma/schema.prisma` — Models, relations และ enums ของฐานข้อมูล
4. `server/prisma.config.js` — ตั้งค่า connection สำหรับ Prisma CLI
5. `server/src/db.js` — Prisma Client และ MariaDB driver adapter
6. `server/src/middleware/auth.js` — ตรวจ Token และ role
7. `server/src/routes/auth.routes.js` — Register/Login/Me
8. `server/src/routes/equipment.routes.js` — CRUD, Status, Soft Delete, Restore
9. `server/src/services/equipment-history.js` — บันทึกข้อมูลก่อนและหลัง

## Request ที่ควรไล่อ่านเป็นตัวอย่าง

### Login

```text
AuthForm -> App.handleSubmit()
-> POST /api/auth/login
-> auth.routes.js
-> bcrypt.compare()
-> jwt.sign()
-> App เก็บ token ใน localStorage
```

### แก้ไขครุภัณฑ์

```text
EquipmentForm -> EquipmentManager.submitForm()
-> api/equipment.js
-> PATCH /api/admin/equipment-items/:id
-> authenticate -> requireAdmin
-> prisma.$transaction()
-> prisma.equipment.update() + prisma.equipment_items.update()
-> prisma.equipment_history.create()
-> transaction สำเร็จและ commit อัตโนมัติ
-> reload ตาราง
```

### Soft Delete

การลบไม่ได้ใช้ `DELETE FROM equipment_items` แต่ใส่วันที่ลง `deleted_at` ข้อมูลจึงยังกู้คืนและตรวจสอบประวัติได้

### เปิดครุภัณฑ์จาก QR

```text
QR -> /equipment/:code
-> App ตรวจ Session
-> EquipmentDetailPage
-> GET /api/equipment-items/:code
-> User ดูรายละเอียด / Admin แก้ไขหรือพิมพ์ QR
```

อ่านวิธีตั้งค่าโทรศัพท์ต่อได้ใน `docs/QR_GUIDE.md`

## คำศัพท์ในโค้ด

- `state` — ข้อมูลในหน่วยความจำของหน้า React เมื่อเปลี่ยนแล้วหน้าจะ render ใหม่
- `props` — ข้อมูลหรือฟังก์ชันที่ Component แม่ส่งให้ Component ลูก
- `middleware` — ฟังก์ชันที่ทำงานก่อน route เช่น ตรวจ Token
- `Prisma Model` — ตัวแทนตารางและความสัมพันธ์ที่ประกาศใน `schema.prisma`
- `Prisma Client` — API สำหรับอ่าน/เขียน MySQL โดยไม่ต้องต่อ string SQL เอง
- `transaction` — ชุดคำสั่งฐานข้อมูลที่ต้องสำเร็จทั้งหมด ไม่เช่นนั้น Prisma rollback
- `Soft Delete` — ซ่อนข้อมูลด้วย `deleted_at` แทนการลบแถวจริง
- `Audit Log` — ประวัติว่าใครเปลี่ยนอะไร เมื่อใด และข้อมูลก่อน/หลังคืออะไร
- `HTTP 401` — ยังไม่ได้ Login หรือ Token ใช้ไม่ได้
- `HTTP 403` — Login แล้วแต่ไม่มีสิทธิ์
- `HTTP 409` — ข้อมูลชนกัน เช่น equipment_code ซ้ำ

## คำสั่งเปิดระบบ

Terminal 1:

```powershell
pnpm --filter asset-server dev
```

Terminal 2:

```powershell
pnpm --filter asset-client dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3000`
