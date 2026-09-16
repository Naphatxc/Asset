// หน้า Login/Register ดูแล state และ logic ของตัวเองทั้งหมด — App.jsx แค่ render หน้านี้เมื่อยังไม่มี user
// Login สำเร็จแล้วตั้งค่า query ['auth','me'] ตรงๆ ที่นี่ App.jsx ที่ subscribe query เดียวกันจะเห็น user ใหม่เองอัตโนมัติ
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { login, register } from '../../api/auth.js';

export default function LoginPage() {
  const location = useLocation();
  const queryClient = useQueryClient();

  const [authMode, setAuthMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ใช้ตัวแปรเดียวควบคุมว่าต้องแสดงช่องชื่อและข้อความแบบ Login หรือ Register
  const isLogin = authMode === 'login';

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      // ตั้งค่า cache ตรงๆ แทนการยิง /me ซ้ำ เพราะ response ของ login ก็มี user อยู่แล้ว
      queryClient.setQueryData(['auth', 'me'], { user: data.user });
    },
  });

  const registerMutation = useMutation({ mutationFn: register });

  // Login และ Register ใช้ฟอร์มเดียวกัน แต่เลือก mutation จาก authMode
  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      if (authMode === 'register') {
        await registerMutation.mutateAsync({ name, email, password });
        setAuthMode('login');
        setName('');
        setPassword('');
        setSuccessMessage('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
        return;
      }

      // สำเร็จแล้ว server จะ set-cookie access_token/csrf_token มาให้เอง ไม่มี token ใน response แล้ว
      await loginMutation.mutateAsync({ email, password });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  // ทุกครั้งที่สลับ Login/Register ต้องล้างข้อมูลและข้อความจากหน้าก่อน
  function switchAuthMode() {
    setError('');
    setSuccessMessage('');
    setName('');
    setEmail('');
    setPassword('');
    setAuthMode((currentMode) =>
      currentMode === 'login' ? 'register' : 'login',
    );
  }

  const loading = loginMutation.isPending || registerMutation.isPending;
  const destinationMessage = location.pathname.startsWith('/equipment/')
    ? 'กรุณาเข้าสู่ระบบเพื่อดูข้อมูลครุภัณฑ์จาก QR Code หลังเข้าสู่ระบบจะกลับมาหน้านี้อัตโนมัติ'
    : '';

  return (
    <main className="app-shell">
      <section className="welcome-card">
        <img className="brand-logo" src="/logo.jpg" alt="Mathematics" />
        <p className="eyebrow">Material & Asset Management</p>
        <h1>{isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</h1>
        <p>
          {isLogin
            ? 'กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน'
            : 'สร้างบัญชีผู้ใช้งานใหม่'}
        </p>
        {destinationMessage && (
          <p className="destination-message">{destinationMessage}</p>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <label>
              ชื่อ-นามสกุล
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="กรอกชื่อ-นามสกุล"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
          )}

          <label>
            อีเมล
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              maxLength={255}
              autoComplete="email"
              required
            />
          </label>

          <label>
            รหัสผ่าน
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="อย่างน้อย 8 ตัวอักษร"
              minLength={8}
              maxLength={72}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {successMessage && (
            <p className="success-message">{successMessage}</p>
          )}
          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading
              ? 'กำลังดำเนินการ...'
              : isLogin
                ? 'เข้าสู่ระบบ'
                : 'สมัครสมาชิก'}
          </button>
        </form>

        <button
          className="auth-switch"
          type="button"
          onClick={switchAuthMode}
        >
          {isLogin
            ? 'ยังไม่มีบัญชี? สมัครสมาชิก'
            : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
      </section>
    </main>
  );
}
