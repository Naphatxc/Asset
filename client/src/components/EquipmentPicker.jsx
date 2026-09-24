// checkbox-list เลือกครุภัณฑ์ได้หลายชิ้น + ช่องค้นหากรองด้วยรหัส/ชื่อ ใช้ร่วมกันทั้งฟอร์มยืมของ Admin และ User
// ตัวที่เลือกไว้แล้วไม่หายไปจากรายการแม้พิมพ์กรองไม่ตรง กันงงว่าเลือกอะไรไว้บ้างระหว่างค้นหาตัวถัดไป
import { useMemo, useState } from 'react';

export default function EquipmentPicker({ items, selectedIds, onToggle }) {
  const [filter, setFilter] = useState('');

  const filteredItems = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter(
      (item) =>
        selectedIds.includes(item.item_id) ||
        item.equipment_code.toLowerCase().includes(normalized) ||
        item.equipment_name.toLowerCase().includes(normalized),
    );
  }, [items, filter, selectedIds]);

  return (
    <div className="equipment-picker">
      <input
        type="text"
        className="equipment-picker-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="พิมพ์รหัสหรือชื่อครุภัณฑ์เพื่อค้นหา..."
      />
      {filteredItems.length === 0 ? (
        <p className="loading-message">ไม่พบครุภัณฑ์ที่ตรงกับคำค้นหา</p>
      ) : (
        <div className="checkbox-list">
          {filteredItems.map((item) => (
            <label key={item.item_id} className="checkbox-list-item">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.item_id)}
                onChange={() => onToggle(item.item_id)}
              />
              <span className="equipment-code">{item.equipment_code}</span>
              <span>{item.equipment_name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
