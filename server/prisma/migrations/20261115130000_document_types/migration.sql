-- CreateTable
CREATE TABLE `document_types` (
    `doc_type` ENUM('idp', 'obe3', 'obe5') NOT NULL,
    `label` VARCHAR(50) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`doc_type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ชื่อเริ่มต้นเท่ากับที่เคยเขียนไว้ในโค้ด Admin เปลี่ยนเองได้ทีหลังจากแท็บ "เอกสาร"
INSERT INTO `document_types` (`doc_type`, `label`, `title`) VALUES
    ('idp', 'IDP', 'แผนพัฒนาบุคลากรรายบุคคล (IDP)'),
    ('obe3', 'OBE 3', 'OBE 3'),
    ('obe5', 'OBE 5', 'OBE 5');
