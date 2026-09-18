// select ปกติซ้อนใต้ input กรองข้อความ เพื่อคงพฤติกรรม native ของ select ไว้ทั้งหมด (required, คีย์บอร์ด,
// screen reader) แค่ช่วยกรองตัวเลือกให้แคบลงตอนรายการยาว (เช่น หมวดหมู่/สถานที่ที่เพิ่มขึ้นเรื่อยๆ)
// ตัวเลือกที่เลือกอยู่แล้วจะไม่ถูกกรองออกไป แม้ label จะไม่ตรงกับคำค้นหาปัจจุบัน กันไม่ให้ select โชว์ค่าว่างหลอกตา
import { useMemo, useState } from 'react';

export default function SearchableSelect({
  name,
  value,
  onChange,
  options,
  placeholder = 'พิมพ์เพื่อค้นหา...',
  emptyLabel = 'ยังไม่ระบุ',
  required = false,
}) {
  const [filter, setFilter] = useState('');

  const filteredOptions = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return options;

    return options.filter(
      (option) =>
        option.value === value ||
        option.label.toLowerCase().includes(normalized),
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
