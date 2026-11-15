// Dialog ให้ Admin เพิ่มบัญชีผู้ใช้ใหม่ — ตั้งรหัสผ่านเริ่มต้นให้ แล้วเจ้าของบัญชีไปเปลี่ยนเองจากเมนู "เปลี่ยนรหัสผ่าน"
import { useState } from 'react';

import PasswordInput from './PasswordInput.jsx';

export default function CreateUserDialog({ submitting, error, onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ name: name.trim(), email: email.trim(), password, role });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="withdraw-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Account</p>
            <h2 id="create-user-title">เพิ่มผู้ใช้งาน</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field-wide">
              ชื่อ
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={100}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- โฟกัสช่องแรกให้พิมพ์ต่อได้ทันที
                autoFocus
                required
              />
            </label>

            <label className="field-wide">
              อีเมล
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={255}
                autoComplete="off"
                required
              />
            </label>

            <label>
              รหัสผ่านเริ่มต้น
              <PasswordInput
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
            </label>

            <label>
              สิทธิ์
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="form-actions">
            <button className="button-primary" type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'เพิ่มผู้ใช้'}
            </button>
            <button className="button-secondary" type="button" onClick={onClose}>
              ยกเลิก
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
