-- Migration สำหรับฐานข้อมูลเดิม: รันครั้งเดียวด้วย root ใน MySQL Workbench
USE asset_management;

-- ใช้ออกรหัสครุภัณฑ์อัตโนมัติ (เช่น "PC" -> PC-0005) ไม่บังคับกรอก เพราะหมวดหมู่เก่าอาจยังไม่ได้ตั้งไว้
ALTER TABLE categories
  ADD COLUMN code_prefix VARCHAR(20) NULL UNIQUE;
