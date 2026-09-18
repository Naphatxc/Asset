// select ปกติ + ตัวเลือกพิเศษท้ายรายการ "+ เพิ่ม...ใหม่" เพื่อให้ผู้ใช้เพิ่มหมวดหมู่/สถานที่ที่ยังไม่มีได้
// ตรงจากฟอร์มครุภัณฑ์เลย ไม่ต้องออกไปหน้าอื่น — เลือกตัวเลือกนี้แล้วสลับไปโชว์ฟอร์มกรอกข้อมูลสั้นๆ แทน select
import { useState } from 'react';
import CharCount from './CharCount.jsx';

const CREATE_OPTION_VALUE = '__create__';

export default function SelectWithCreate({
  name,
  value,
  onChange,
  options,
  required = false,
  emptyLabel = 'ยังไม่ระบุ',
  createLabel,
  createFields,
  onCreate,
}) {
  const [creating, setCreating] = useState(false);
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleSelectChange(event) {
    if (event.target.value === CREATE_OPTION_VALUE) {
      setError('');
      setFields({});
      setCreating(true);
      return;
    }

    onChange(event);
  }

  function updateField(fieldName, fieldValue) {
    setFields((current) => ({ ...current, [fieldName]: fieldValue }));
  }

  async function submitCreate() {
    setError('');
    setSubmitting(true);

    try {
      const created = await onCreate(fields);
      setCreating(false);
      setFields({});
      // เลือกตัวที่เพิ่งสร้างให้ทันที เสมือนผู้ใช้เลือกจาก select เอง
      onChange({ target: { name, value: created.value } });
    } catch (submitError) {
      setError(submitError.message ?? 'เพิ่มไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitCreate();
    }
  }

  function cancelCreate() {
    setCreating(false);
    setError('');
    setFields({});
  }

  if (creating) {
    return (
      <div className="select-with-create">
        {createFields.map((field, index) => (
          <div key={field.name} className="select-with-create-field">
            <input
              type="text"
              placeholder={field.label}
              value={fields[field.name] ?? ''}
              onChange={(event) => updateField(field.name, event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={field.maxLength}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- โฟกัสช่องแรกให้พิมพ์ต่อได้ทันทีหลังกดเพิ่ม
              autoFocus={index === 0}
            />
            {field.maxLength && (
              <CharCount
                length={(fields[field.name] ?? '').length}
                max={field.maxLength}
              />
            )}
          </div>
        ))}
        {error && <p className="error-message select-with-create-error">{error}</p>}
        <div className="select-with-create-actions">
          <button
            type="button"
            className="button-primary"
            onClick={submitCreate}
            disabled={submitting}
          >
            {submitting ? 'กำลังเพิ่ม...' : 'เพิ่ม'}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={cancelCreate}
            disabled={submitting}
          >
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  return (
    <select name={name} value={value} onChange={handleSelectChange} required={required}>
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      <option value={CREATE_OPTION_VALUE}>{createLabel}</option>
    </select>
  );
}
