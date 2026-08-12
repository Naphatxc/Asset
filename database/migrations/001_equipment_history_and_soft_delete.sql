-- Migration สำหรับฐานข้อมูลเดิม: รันครั้งเดียวด้วย root ใน MySQL Workbench
USE asset_management;

-- เพิ่มวันสร้าง/แก้ไข และ deleted_at สำหรับ Soft Delete
ALTER TABLE equipment_items
  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN deleted_at DATETIME NULL;

-- สร้าง Audit Log โดยไม่ต้องลบหรือสร้าง equipment_items ใหม่
CREATE TABLE equipment_history (
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
