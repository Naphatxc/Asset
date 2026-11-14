-- ย้ายบัญชี student เดิมเป็น user ก่อน ไม่งั้นการลบค่า enum จะล้มเหลวเพราะมีแถวที่ใช้ค่านี้อยู่
UPDATE `users` SET `role` = 'user' WHERE `role` = 'student';

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user';
