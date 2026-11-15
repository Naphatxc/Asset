-- AlterTable
ALTER TABLE `audit_rounds` ADD COLUMN `location_id` INTEGER UNSIGNED NULL;

-- CreateIndex
CREATE INDEX `fk_audit_round_location` ON `audit_rounds`(`location_id`);

-- AddForeignKey
ALTER TABLE `audit_rounds` ADD CONSTRAINT `fk_audit_round_location` FOREIGN KEY (`location_id`) REFERENCES `locations`(`location_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
