// ช่องเลือกวันที่แบบ พ.ศ. ใช้แทน <input type="date">
// ไม่ใช้ input date ของ browser เพราะปฏิทินของมันแสดงตามภาษาเครื่อง (mm/dd/yyyy ค.ศ.) บังคับเป็น พ.ศ. ไม่ได้
// ค่า value/onChange ยังเป็น YYYY-MM-DD แบบ ค.ศ. เหมือน input date เดิม ส่ง API ได้ตรงๆ แปลง พ.ศ. แค่ตอนแสดงผล
import { useEffect, useId, useRef, useState } from 'react';

const BUDDHIST_ERA_OFFSET = 543;
const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function pad(number) {
  return String(number).padStart(2, '0');
}

function toIso(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function todayIso() {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

// 2026-09-25 → 25/09/2569
function formatThai(value) {
  const parts = parseIso(value);
  if (!parts) return '';
  return `${pad(parts.day)}/${pad(parts.month + 1)}/${parts.year + BUDDHIST_ERA_OFFSET}`;
}

// 25/9/2569 → 2026-09-25 (ถ้าพิมพ์ปีต่ำกว่า 2400 ถือว่าเป็น ค.ศ.) ไม่ใช่วันที่จริงคืน null
function parseThai(text) {
  const match = /^\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})\s*$/.exec(text);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  let year = Number(match[3]);
  if (year >= 2400) year -= BUDDHIST_ERA_OFFSET;

  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return toIso(year, month, day);
}

export default function ThaiDateInput({
  name,
  value,
  onChange, // เรียกด้วย { target: { name, value } } รูปแบบเดียวกับ onChange ของ input เดิม
  min, // YYYY-MM-DD วันก่อนหน้านี้เลือกไม่ได้
  required = false,
}) {
  const popupId = useId();
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(formatThai(value));
  const [view, setView] = useState(() => parseIso(value || todayIso()));

  // value เปลี่ยนจากข้างนอก (เช่นรีเซ็ตฟอร์ม) ให้ข้อความในช่องตาม
  useEffect(() => {
    setText(formatThai(value));
  }, [value]);

  const tooEarly = Boolean(value && min && value < min);
  const invalidText = text.trim() !== '' && !parseThai(text);

  useEffect(() => {
    let message = '';
    if (invalidText) message = 'กรอกวันที่เป็น วว/ดด/ปปปป (พ.ศ.)';
    else if (required && !value) message = 'กรุณาเลือกวันที่';
    else if (tooEarly) message = `เลือกได้ตั้งแต่ ${formatThai(min)} เป็นต้นไป`;
    inputRef.current?.setCustomValidity(message);
  }, [invalidText, required, value, tooEarly, min]);

  function emit(nextValue) {
    onChange({ target: { name, value: nextValue } });
  }

  function openPopup() {
    setView(parseIso(value || (min && min > todayIso() ? min : todayIso())));
    setOpen(true);
  }

  function choose(nextValue) {
    emit(nextValue);
    setText(formatThai(nextValue));
    setOpen(false);
    inputRef.current?.focus();
  }

  function shiftMonth(step) {
    setView(({ year, month }) => {
      const date = new Date(year, month + step, 1);
      return { year: date.getFullYear(), month: date.getMonth(), day: 1 };
    });
  }

  function handleTextChange(event) {
    const nextText = event.target.value;
    setText(nextText);

    const parsed = parseThai(nextText);
    if (parsed) {
      emit(parsed);
      setView(parseIso(parsed));
    } else if (nextText.trim() === '') {
      emit('');
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown' && !open) {
      event.preventDefault();
      openPopup();
    }
  }

  // ปิดเมื่อ focus ออกไปนอกกล่องนี้ (คลิกที่อื่น/กด Tab ออก) และคืนข้อความให้ตรงกับค่าจริงถ้าพิมพ์ค้างไว้ผิด
  function handleBlur(event) {
    if (wrapperRef.current?.contains(event.relatedTarget)) return;
    setOpen(false);
    if (!parseThai(text)) setText(formatThai(value));
  }

  const { year, month } = view;
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const thisYear = new Date().getFullYear();
  const firstYear = Math.min(year, thisYear - 50);
  const lastYear = Math.max(year, thisYear + 20);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const today = todayIso();

  return (
    <div className="thai-date" ref={wrapperRef} onBlur={handleBlur}>
      <div className="thai-date-field">
        <input
          ref={inputRef}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="วว/ดด/ปปปป"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popupId}
          value={text}
          onChange={handleTextChange}
          onClick={() => !open && openPopup()}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="thai-date-toggle"
          aria-label="เปิดปฏิทิน"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (open ? setOpen(false) : openPopup())}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm-2 8h14v10H5V10z"
            />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="thai-date-popup"
          id={popupId}
          role="dialog"
          aria-label="เลือกวันที่"
          // ไม่ให้คลิกในปฏิทินดึง focus ออกจากช่อง (ปฏิทินจะปิด) ยกเว้น select ที่ต้องได้ focus ถึงจะเปิดรายการได้
          onMouseDown={(event) => {
            if (event.target.tagName !== 'SELECT') event.preventDefault();
          }}
          // ปฏิทินอยู่ใน <label> คลิกพื้นที่ว่างแล้ว label จะส่ง click ต่อให้ input
          onClick={(event) => {
            if (event.target === event.currentTarget) event.preventDefault();
          }}
        >
          <div className="thai-date-header">
            <button type="button" aria-label="เดือนก่อน" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <select
              aria-label="เดือน"
              value={month}
              onChange={(event) => setView({ year, month: Number(event.target.value), day: 1 })}
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="ปี พ.ศ."
              value={year}
              onChange={(event) => setView({ year: Number(event.target.value), month, day: 1 })}
            >
              {years.map((optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear + BUDDHIST_ERA_OFFSET}
                </option>
              ))}
            </select>
            <button type="button" aria-label="เดือนถัดไป" onClick={() => shiftMonth(1)}>
              ›
            </button>
          </div>

          <div className="thai-date-grid">
            {WEEKDAYS.map((label) => (
              <span key={label} className="thai-date-weekday">
                {label}
              </span>
            ))}
            {cells.map((day, index) => {
              if (!day) return <span key={`blank-${index}`} />;
              const iso = toIso(year, month, day);
              return (
                <button
                  key={iso}
                  type="button"
                  className={[
                    'thai-date-day',
                    iso === value && 'selected',
                    iso === today && 'today',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={Boolean(min && iso < min)}
                  onClick={() => choose(iso)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="thai-date-footer">
            <button type="button" onClick={() => choose('')}>
              ล้าง
            </button>
            <button type="button" disabled={Boolean(min && today < min)} onClick={() => choose(today)}>
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
