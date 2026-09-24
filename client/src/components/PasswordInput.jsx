// ช่องรหัสผ่านพร้อมปุ่มรูปตาเปิด/ปิดการมองเห็น ใช้ร่วมกันทุกฟอร์มที่กรอกรหัสผ่าน
// props อื่นส่งต่อให้ <input> ตรงๆ (value/onChange/autoComplete/minLength ฯลฯ) ใช้แทน <input type="password"> ได้เลย
import { useState } from 'react';

function EyeIcon({ crossed }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      {crossed && (
        <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-field">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        aria-pressed={visible}
        title={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
      >
        <EyeIcon crossed={visible} />
      </button>
    </span>
  );
}
