-- AlterTable
ALTER TABLE `audit_records` ADD COLUMN `closing_outcome` ENUM('missing', 'borrowed', 'in_repair', 'deleted') NULL;

