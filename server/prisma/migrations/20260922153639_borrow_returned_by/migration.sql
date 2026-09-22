-- AlterTable
ALTER TABLE `borrow_details` ADD COLUMN `returned_by` INTEGER UNSIGNED NULL;

-- CreateIndex
CREATE INDEX `fk_borrow_detail_returned_by` ON `borrow_details`(`returned_by`);

-- AddForeignKey
ALTER TABLE `borrow_details` ADD CONSTRAINT `fk_borrow_detail_returned_by` FOREIGN KEY (`returned_by`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;


-- Backfill: ใบที่คืนไปแล้วก่อนมีคอลัมน์นี้ ดึงคนกดรับคืนจาก equipment_history ที่ borrow.service.js บันทึกไว้ทุกครั้ง
-- ที่ admin รับคืน (status_changed จาก borrowed -> available พร้อม borrow_id ของใบนั้น)
UPDATE `borrow_details` bd
JOIN `equipment_history` h ON h.item_id = bd.item_id
  AND h.action = 'status_changed'
  AND JSON_UNQUOTE(JSON_EXTRACT(h.old_data, '$.status')) = 'borrowed'
  AND JSON_EXTRACT(h.old_data, '$.borrow_id') = bd.borrow_id
  AND JSON_UNQUOTE(JSON_EXTRACT(h.new_data, '$.status')) = 'available'
SET bd.returned_by = h.changed_by
WHERE bd.returned_at IS NOT NULL AND bd.returned_by IS NULL;
