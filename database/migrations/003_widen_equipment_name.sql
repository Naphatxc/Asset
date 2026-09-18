-- Migration สำหรับฐานข้อมูลเดิม: รันครั้งเดียวด้วย root ใน MySQL Workbench
USE asset_management;

-- ข้อมูลครุภัณฑ์จริงจากระบบเก่า (ยังไม่ได้ migrate เข้าระบบนี้) มีชื่อยาวสุดถึง 194 ตัวอักษร
-- ซึ่งเกินขนาดเดิม VARCHAR(150) แล้ว ขยายเป็น 255 ไว้ก่อน migrate ข้อมูลจริงเข้ามา
ALTER TABLE equipment
  MODIFY COLUMN equipment_name VARCHAR(255) NOT NULL;

ALTER TABLE equipment_items
  MODIFY COLUMN equipment_name VARCHAR(255) NOT NULL;
