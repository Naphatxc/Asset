# คู่มือระบบ QR Code ครุภัณฑ์

QR Code เก็บ URL รูปแบบ `/equipment/:code` ไม่ได้เก็บรายละเอียดครุภัณฑ์โดยตรง ดังนั้นเมื่อแก้ชื่อ ราคา สถานที่ หรือสถานะ ไม่ต้องพิมพ์ QR ใหม่

## การทำงาน

```text
สแกน QR
  -> เปิด /equipment/STAT-PC-0001
  -> ถ้ายังไม่ Login จะแสดงหน้า Login ที่ URL เดิม
  -> Login สำเร็จแล้วโหลด GET /api/equipment-items/STAT-PC-0001
  -> User ดูรายละเอียดได้
  -> Admin ดู QR ดาวน์โหลด พิมพ์ และแก้ข้อมูลได้
```

## ทดสอบบนคอม

Terminal 1:

```powershell
npm.cmd run dev:server
```

Terminal 2:

```powershell
npm.cmd run dev:client
```

เปิด `http://localhost:5173` แล้ว Login ด้วย Admin จากนั้นกด `QR Code` ในตารางครุภัณฑ์

## ทดสอบจากโทรศัพท์ใน Wi-Fi เดียวกัน

1. ดู IPv4 ของคอมด้วย `ipconfig` เช่น `192.168.1.100`
2. สร้าง `client/.env.local` โดยอ้างอิง `client/.env.example`
3. ตั้งค่าดังนี้ โดยเปลี่ยน IP ให้ตรงกับเครื่อง

```dotenv
VITE_API_URL=http://192.168.1.100:3000
VITE_PUBLIC_APP_URL=http://192.168.1.100:5173
```

4. เพิ่ม URL ของ Frontend ใน `server/.env`

```dotenv
CLIENT_ORIGIN=http://localhost:5173,http://192.168.1.100:5173
```

5. Restart Server แล้วเปิด Frontend แบบ LAN

```powershell
npm.cmd run dev:client:lan
```

6. อนุญาต Windows Firewall เฉพาะ Private network หาก Windows ถาม
7. เปิด `http://192.168.1.100:5173` จากโทรศัพท์ หรือสแกน QR ที่สร้างใหม่

> โทรศัพท์และคอมต้องอยู่ Wi-Fi เดียวกัน และต้องสร้าง QR ใหม่หลังเปลี่ยน `VITE_PUBLIC_APP_URL`

## สิทธิ์และกรณีผิดพลาด

- ไม่มี Token หรือ Token ปลอม: API ตอบ `401` และหน้าเว็บกลับไป Login
- User: ดูรายละเอียดจาก QR ได้ แต่ไม่มีปุ่มสร้าง QR หรือแก้ไข
- Admin: ดูรายละเอียด สร้าง/ดาวน์โหลด/พิมพ์ QR และแก้ไขข้อมูลได้
- รหัสไม่อยู่ในฐานข้อมูลหรือถูก Soft Delete: แสดงหน้า `404 ไม่พบครุภัณฑ์`
