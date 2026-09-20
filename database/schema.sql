-- ไฟล์นี้ใช้สร้างฐานข้อมูลใหม่ตั้งแต่ต้น ทุก CREATE ใช้ IF NOT EXISTS จึงรันซ้ำได้
-- หมายเหตุเรื่องเรียงข้อความไทย: MySQL ไม่มี collation ที่เข้าใจกฎพจนานุกรมไทย (สระนำอย่าง "เ" ต้อง
-- เรียงราวกับอยู่หลังพยัญชนะ) ให้ใช้กับ utf8mb4 เลย มีแต่ tis620_thai_ci ซึ่งผูกกับ charset tis620 เก่าที่
-- เก็บได้แค่ไทย/อังกฤษ ไม่รองรับ Unicode เต็มรูปแบบ จึงไม่ใช้ตรงนี้ — การเรียงแบบพจนานุกรมไทยทำที่ฝั่ง
-- แอปด้วย Intl.Collator('th') แทน (ดู server/src/modules/options/options.service.js)
CREATE DATABASE IF NOT EXISTS asset_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE asset_management;

-- บัญชีสำหรับ Login: password_hash เก็บค่าจาก bcrypt ไม่ใช่รหัสผ่านจริง
CREATE TABLE IF NOT EXISTS users (
  user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- หมวดหมู่และสถานที่เป็นข้อมูลกลางสำหรับ dropdown ในฟอร์มครุภัณฑ์/วัสดุ
CREATE TABLE IF NOT EXISTS categories (
  category_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  -- ใช้ออกรหัสครุภัณฑ์อัตโนมัติ (เช่น "PC" -> PC-0005) ไม่บังคับกรอก เพราะหมวดหมู่เก่าอาจยังไม่ได้ตั้งไว้
  code_prefix VARCHAR(20) NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS locations (
  location_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  location_name VARCHAR(100) NOT NULL,
  building VARCHAR(100) NULL,
  room VARCHAR(30) NULL
);

-- equipment เก็บข้อมูลร่วมของครุภัณฑ์ เช่น ชื่อ หมวดหมู่ และสถานที่
CREATE TABLE IF NOT EXISTS equipment (
  equipment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- 255 ไม่ใช่ 150 เพราะข้อมูลครุภัณฑ์จริงจากระบบเก่ามีชื่อยาวสุดถึง 194 ตัวอักษร
  equipment_name VARCHAR(255) NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NULL,
  fiscal_year YEAR NULL,
  description TEXT NULL,
  receive_date DATE NULL,
  remark TEXT NULL,
  CONSTRAINT fk_equipment_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
  CONSTRAINT fk_equipment_location FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

-- equipment_items เก็บครุภัณฑ์แต่ละชิ้นที่มีรหัสไม่ซ้ำและจะนำไปสร้าง QR
CREATE TABLE IF NOT EXISTS equipment_items (
  item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT UNSIGNED NOT NULL,
  equipment_name VARCHAR(255) NOT NULL,
  equipment_code VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('available', 'borrowed', 'pending_repair', 'repairing') NOT NULL DEFAULT 'available',
  price DECIMAL(10,2) NULL,
  warranty_expire DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL, -- NULL = ใช้งานอยู่, มีวันที่ = ถูก Soft Delete
  CONSTRAINT fk_item_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
);

-- Audit Log เก็บ snapshot JSON ก่อน/หลัง พร้อม Admin ที่เป็นผู้เปลี่ยน
CREATE TABLE IF NOT EXISTS equipment_history (
  history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  action ENUM('created', 'updated', 'status_changed', 'deleted', 'restored') NOT NULL,
  old_data JSON NULL,
  new_data JSON NULL,
  changed_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_equipment_history_item (item_id),
  INDEX idx_equipment_history_changed_by (changed_by),
  CONSTRAINT fk_history_item FOREIGN KEY (item_id) REFERENCES equipment_items(item_id),
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(user_id)
);

-- borrows เก็บใบยืม 1 ใบต่อการยืม 1 ครั้ง อาจมีครุภัณฑ์หลายชิ้นอยู่ใน borrow_details
-- status: pending = user ส่งคำขอ รออนุมัติ (ครุภัณฑ์ยังไม่ถูกล็อกเป็น borrowed), approved = Admin อนุมัติแล้ว (หรือ Admin สร้างใบยืมเองซึ่งถือว่าอนุมัติทันที),
-- rejected = Admin ปฏิเสธคำขอ
CREATE TABLE IF NOT EXISTS borrows (
  borrow_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  borrow_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  remark TEXT NULL,
  CONSTRAINT fk_borrow_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- borrow_details เก็บแต่ละชิ้นที่ยืมในใบยืมนั้น สถานะ (ยืมอยู่/เลยกำหนด/รอยืนยันคืน/คืนแล้ว) derive จาก
-- return_date/return_requested_at/returned_at ไม่เก็บเป็น column แยกเพื่อไม่ให้ข้อมูลไม่ตรงกัน
CREATE TABLE IF NOT EXISTS borrow_details (
  borrow_detail_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  borrow_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  return_date DATETIME NOT NULL, -- วันครบกำหนดคืน ตั้งตอนยืม
  return_requested_at DATETIME NULL, -- ผู้ยืมกดคืนเมื่อไหร่ (รอ Admin ยืนยัน), NULL = ยังไม่ได้ขอคืน
  returned_at DATETIME NULL, -- Admin ยืนยันคืนจริงเมื่อไหร่, NULL = ยังไม่คืน
  INDEX idx_borrow_details_borrow (borrow_id),
  INDEX idx_borrow_details_item (item_id),
  CONSTRAINT fk_borrow_detail_borrow FOREIGN KEY (borrow_id) REFERENCES borrows(borrow_id),
  CONSTRAINT fk_borrow_detail_item FOREIGN KEY (item_id) REFERENCES equipment_items(item_id)
);

-- ตารางวัสดุสิ้นเปลือง เตรียมไว้สำหรับระบบสต็อกในขั้นถัดไป
CREATE TABLE IF NOT EXISTS materials (
  material_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  material_code VARCHAR(50) NOT NULL UNIQUE,
  material_name VARCHAR(150) NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  minimum_quantity INT NOT NULL DEFAULT 0,
  expire_date DATE NULL,
  unit_name VARCHAR(50) NOT NULL,
  unit_price DECIMAL(10,2) NULL,
  remark TEXT NULL,
  deleted_at DATETIME NULL, -- NULL = ใช้งานอยู่, มีวันที่ = ถูก Soft Delete
  CONSTRAINT fk_material_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
  CONSTRAINT chk_material_quantity CHECK (quantity >= 0)
);

-- ประวัติการเบิกวัสดุ: ตัดยอด quantity ทันทีตอนเบิก ไม่มีขั้นตอนรออนุมัติและไม่มีการคืน
CREATE TABLE IF NOT EXISTS material_withdrawals (
  withdrawal_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  material_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  remark TEXT NULL,
  withdrawn_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_withdrawals_material (material_id),
  INDEX idx_withdrawals_user (user_id),
  CONSTRAINT fk_withdrawal_material FOREIGN KEY (material_id) REFERENCES materials(material_id),
  CONSTRAINT fk_withdrawal_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- repairs เก็บ 1 รายการแจ้งซ่อมต่อครุภัณฑ์ 1 ชิ้น status: pending_repair = แจ้งแล้วรอเริ่มซ่อม,
-- repairing = กำลังซ่อม, completed = ซ่อมเสร็จ (equipment_items กลับเป็น available), cancelled = ยกเลิกแจ้งซ่อม
CREATE TABLE IF NOT EXISTS repairs (
  repair_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  reported_by INT UNSIGNED NOT NULL,
  issue TEXT NOT NULL,
  repair_detail TEXT NULL,
  repair_cost DECIMAL(10,2) NULL,
  repair_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending_repair', 'repairing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending_repair',
  INDEX idx_repairs_item (item_id),
  CONSTRAINT fk_repair_item FOREIGN KEY (item_id) REFERENCES equipment_items(item_id),
  CONSTRAINT fk_repair_user FOREIGN KEY (reported_by) REFERENCES users(user_id)
);

-- repair_files เก็บไฟล์แนบ (รูป/PDF) ของแต่ละรายการแจ้งซ่อม ไฟล์จริงเก็บที่ server/uploads/repairs
CREATE TABLE IF NOT EXISTS repair_files (
  file_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_id INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NULL,
  INDEX idx_repair_files_repair (repair_id),
  CONSTRAINT fk_repair_file_repair FOREIGN KEY (repair_id) REFERENCES repairs(repair_id)
);
