-- Migration สำหรับฐานข้อมูลเดิม: รันครั้งเดียว (ถ้าคอลัมน์/ตารางมีอยู่แล้วจะ error "Duplicate column" / "already exists" ให้ข้ามคำสั่งนั้น)
-- บน Railway ไม่ต้องใช้ USE asset_management; ให้รันใน database ที่ตรงกับ DB_NAME ของ server (ค่าเริ่มต้นของ Railway คือ "railway")

-- ใบยืมมีหมายเหตุ (กรอกตอน Admin สร้างใบยืม หรือ user ส่งคำขอ)
ALTER TABLE borrows
  ADD COLUMN remark TEXT NULL;

-- วัสดุใช้ Soft Delete เหมือน equipment_items กันลบแล้วประวัติการเบิกอ้างอิงไม่ได้
ALTER TABLE materials
  ADD COLUMN deleted_at DATETIME NULL;

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
