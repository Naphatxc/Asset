CREATE DATABASE IF NOT EXISTS asset_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE asset_management;

CREATE TABLE users (
  user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  category_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL
);

CREATE TABLE locations (
  location_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  location_name VARCHAR(100) NOT NULL,
  building VARCHAR(100) NULL,
  room VARCHAR(30) NULL
);

CREATE TABLE equipment (
  equipment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  equipment_name VARCHAR(150) NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NULL,
  fiscal_year YEAR NULL,
  description TEXT NULL,
  receive_date DATE NULL,
  remark TEXT NULL,
  CONSTRAINT fk_equipment_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
  CONSTRAINT fk_equipment_location FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

CREATE TABLE equipment_items (
  item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT UNSIGNED NOT NULL,
  equipment_name VARCHAR(150) NOT NULL,
  equipment_code VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('available', 'borrowed', 'pending_repair', 'repairing') NOT NULL DEFAULT 'available',
  price DECIMAL(10,2) NULL,
  warranty_expire DATE NULL,
  CONSTRAINT fk_item_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
);

CREATE TABLE materials (
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
  CONSTRAINT fk_material_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
  CONSTRAINT chk_material_quantity CHECK (quantity >= 0)
);
