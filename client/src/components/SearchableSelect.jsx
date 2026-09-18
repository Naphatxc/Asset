// select ปกติ + input กรองด้านบน ช่วยหาตัวเลือกเร็วขึ้นตอนรายการยาว (เช่น รายชื่อผู้ใช้/ครุภัณฑ์)
// ต่างจาก SelectWithCreate ตรงที่ตัวนี้ไม่มีความสามารถเพิ่มตัวเลือกใหม่ ใช้ตอนเลือกจากของที่มีอยู่แล้วอย่างเดียว
import { useMemo, useState } from 'react';

export default function SearchableSelect({
  name,
  value,
  onChange,
  options, // [{ value, label, searchText? }] — searchText ไม่ระบุก็ใช้ label กรองแทน
  required = false,
  emptyLabel = 'เลือก...',
  placeholder = 'พิมพ์เพื่อค้นหา...',
}) {
  const [filter, setFilter] = useState('');

  const filteredOptions = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return options;

    return options.filter(
      (option) =>
        option.value === value ||
        (option.searchText ?? option.label).toLowerCase().includes(normalized),
    );
  }, [options, filter, value]);

  return (
    <div className="searchable-select">
      <input
        type="text"
        className="searchable-select-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder={placeholder}
      />
      <select name={name} value={value} onChange={onChange} required={required}>
        <option value="">{emptyLabel}</option>
        {filteredOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
