-- AlterTable
ALTER TABLE `equipment_items` MODIFY `status` ENUM('available', 'borrowed', 'pending_repair', 'repairing', 'disposed') NOT NULL DEFAULT 'available';

-- Backfill: ครุภัณฑ์ที่ถูก "ลบ" (soft delete) ไปก่อนหน้านี้ นับเป็นจำหน่ายออกแล้วทั้งหมด สถานะเดิมยังอยู่ใน
-- equipment_history (action = 'deleted', old_data.status) ใช้คืนสถานะตอนกู้คืน (ดู restoreEquipment)
UPDATE `equipment_items` SET `status` = 'disposed' WHERE `deleted_at` IS NOT NULL;
