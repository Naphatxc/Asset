// ช่องเลือกแบบพิมพ์ค้นหาในช่องเดียว (combobox) ใช้ตอนรายการยาว เช่น รายชื่อผู้ใช้/ครุภัณฑ์
// ไม่ใช้ <select> ปกติ เพราะรายการของ select เปิดเต็มจอตามขนาดที่ browser กำหนดเอง คุมความกว้าง/สูงไม่ได้
// ต่างจาก SelectWithCreate ตรงที่ตัวนี้ไม่มีความสามารถเพิ่มตัวเลือกใหม่ ใช้ตอนเลือกจากของที่มีอยู่แล้วอย่างเดียว
import { useEffect, useId, useMemo, useRef, useState } from 'react';

// รายการครุภัณฑ์มีได้หลายพันชิ้น วาดทั้งหมดทุกครั้งที่พิมพ์จะหน่วง จึงแสดงแค่ส่วนแรก ให้พิมพ์เพิ่มเพื่อแคบลง
const MAX_VISIBLE = 100;

export default function SearchableSelect({
  name,
  value,
  onChange, // เรียกด้วย { target: { name, value } } รูปแบบเดียวกับ onChange ของ <select> เดิม
  options, // [{ value, label, searchText? }] — searchText ไม่ระบุก็ใช้ label กรองแทน
  required = false,
  emptyLabel = 'เลือก...',
  placeholder = 'พิมพ์เพื่อค้นหา...',
}) {
  const listId = useId();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.value === value);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;

    return options.filter((option) =>
      (option.searchText ?? option.label).toLowerCase().includes(normalized),
    );
  }, [options, query]);
  const visible = matches.slice(0, MAX_VISIBLE);

  // required กับ input ที่แสดงข้อความ: พิมพ์ค้างไว้แต่ไม่ได้กดเลือกต้องไม่ผ่าน จึงเช็คจาก value จริงแทนข้อความในช่อง
  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !value ? emptyLabel : '');
  }, [required, value, emptyLabel]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function openList() {
    setQuery('');
    setActiveIndex(Math.max(0, options.indexOf(selected)));
    setOpen(true);
  }

  function choose(option) {
    onChange({ target: { name, value: option.value } });
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return openList();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => Math.min(Math.max(index + step, 0), visible.length - 1));
    } else if (event.key === 'Enter' && open) {
      // กัน Enter ส่งฟอร์มตอนกำลังเลือกจากรายการ
      event.preventDefault();
      if (visible[activeIndex]) choose(visible[activeIndex]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="combobox">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className="combobox-input"
        value={open ? query : (selected?.label ?? '')}
        placeholder={open && selected ? selected.label : placeholder}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={() => {
          setOpen(false);
          setQuery('');
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <ul
          className="combobox-list"
          id={listId}
          role="listbox"
          ref={listRef}
          // ช่องนี้มักอยู่ใน <label> คลิกในรายการแล้ว label จะส่ง click ต่อให้ input จนรายการเด้งเปิดใหม่
          onClick={(event) => event.preventDefault()}
        >
          {visible.length === 0 ? (
            <li className="combobox-empty">ไม่พบรายการที่ตรงกับ "{query.trim()}"</li>
          ) : (
            visible.map((option, index) => (
              <li
                key={option.value}
                data-index={index}
                role="option"
                aria-selected={option.value === value}
                className={[
                  'combobox-option',
                  index === activeIndex && 'active',
                  option.value === value && 'selected',
                ]
                  .filter(Boolean)
                  .join(' ')}
                // mousedown ไม่ใช่ click: ต้องเลือกก่อน input เสีย focus แล้วปิดรายการทิ้ง
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {option.label}
              </li>
            ))
          )}
          {matches.length > MAX_VISIBLE && (
            <li className="combobox-empty">
              แสดง {MAX_VISIBLE} จาก {matches.length} รายการ พิมพ์เพิ่มเพื่อค้นหา
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
