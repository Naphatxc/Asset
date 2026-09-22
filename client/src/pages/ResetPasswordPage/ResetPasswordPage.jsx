// หน้าตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล (/reset-password?token=...) เปิดได้โดยไม่ต้อง login
// App.jsx แสดงหน้านี้ก่อนเช็คว่า login อยู่ไหม ถ้าเปิดจากเครื่องที่ login ค้างไว้ ตั้งรหัสแล้ว session นั้นก็หลุดเหมือนเครื่องอื่น
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { resetPassword } from '../../api/auth.js';
import PasswordInput from '../../components/PasswordInput.jsx';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: resetPassword,
    onError: (mutationError) => setError(mutationError.message),
  });

  function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }

    mutation.mutate({ token, newPassword });
  }

  // session ในเครื่องนี้ (ถ้ามี) ใช้ไม่ได้แล้วหลังตั้งรหัสใหม่ ล้างทิ้งก่อนกลับไปหน้า login
  function goToLogin() {
    queryClient.setQueryData(['auth', 'me'], null);
    navigate('/', { replace: true });
  }

  return (
    <main className="app-shell">
      <section className="welcome-card">
        <img className="brand-logo" src="/logo.jpg" alt="Mathematics" />
        <p className="eyebrow">Material & Asset Management</p>
        <h1>ตั้งรหัสผ่านใหม่</h1>

        {!token ? (
          <p className="error-message">ลิงก์ไม่ถูกต้อง กรุณาเปิดลิงก์จากอีเมลอีกครั้ง หรือขอลิงก์ใหม่</p>
        ) : mutation.isSuccess ? (
          <p className="success-message">{mutation.data.message}</p>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              รหัสผ่านใหม่
              <PasswordInput
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
            </label>

            <label>
              ยืนยันรหัสผ่านใหม่
              <PasswordInput
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
            </label>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
            </button>
          </form>
        )}

        <button className="auth-switch" type="button" onClick={goToLogin}>
          ไปหน้าเข้าสู่ระบบ
        </button>
      </section>
    </main>
  );
}
