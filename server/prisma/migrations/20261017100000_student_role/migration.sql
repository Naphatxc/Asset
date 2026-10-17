-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('admin', 'user', 'student') NOT NULL DEFAULT 'user';

