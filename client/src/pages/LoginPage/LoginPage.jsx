// หน้า Login/Register ดูแล state และ logic ของตัวเองทั้งหมด — App.jsx แค่ render หน้านี้เมื่อยังไม่มี user
// Login สำเร็จแล้วตั้งค่า query ['auth','me'] ตรงๆ ที่นี่ App.jsx ที่ subscribe query เดียวกันจะเห็น user ใหม่เองอัตโนมัติ
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { forgotPassword, login, register } from '../../api/auth.js';
import AuthHeader from '../../components/AuthHeader.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import { useToast } from '../../components/ToastProvider.jsx';

// สำเร็จแล้วแจ้งเป็น toast เหมือนส่วนอื่นของระบบ ส่วน error ยังแสดงค้างใต้ฟอร์มเพราะต้องแก้ข้อมูลที่กรอกตาม
export default function LoginPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showSuccess } = useToast();

  const [authMode, setAuthMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // ใช้ตัวแปรเดียวควบคุมว่าต้องแสดงช่องชื่อและข้อความแบบ Login หรือ Register
  const isLogin = authMode === 'login';
  const isForgot = authMode === 'forgot';

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      // ตั้งค่า cache ตรงๆ แทนการยิง /me ซ้ำ เพราะ response ของ login ก็มี user อยู่แล้ว
      queryClient.setQueryData(['auth', 'me'], { user: data.user });
    },
  });

  const registerMutation = useMutation({ mutationFn: register });
  const forgotMutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (data) => showSuccess(data.message),
    onError: (mutationError) => setError(mutationError.message),
  });

  // Login และ Register ใช้ฟอร์มเดียวกัน แต่เลือก mutation จาก authMode
  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      if (authMode === 'register') {
        await registerMutation.mutateAsync({ name, email, password });
        setAuthMode('login');
        setName('');
        setPassword('');
        showSuccess('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
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
    setName('');
    setEmail('');
    setPassword('');
    setAuthMode((currentMode) =>
      currentMode === 'login' ? 'register' : 'login',
    );
  }

  // ลืมรหัสผ่าน: กรอกอีเมลแล้วระบบส่งลิงก์ตั้งรหัสใหม่ไปให้ เก็บอีเมลที่พิมพ์ไว้ในหน้า login มาใส่ให้เลย
  function openForgotPassword() {
    setError('');
    setPassword('');
    forgotMutation.reset();
    setAuthMode('forgot');
  }

  function backToLogin() {
    setError('');
    setAuthMode('login');
  }

  function handleForgotSubmit(event) {
    event.preventDefault();
    setError('');
    forgotMutation.mutate(email);
  }

  if (isForgot) {
    return (
      <main className="app-shell">
        <section className="welcome-card">
          <AuthHeader title="ลืมรหัสผ่าน">
            <p>กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้ (ใช้ได้ 30 นาที)</p>
          </AuthHeader>

          <form className="login-form" onSubmit={handleForgotSubmit}>
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

            {error && <p className="error-message">{error}</p>}

            <button type="submit" disabled={forgotMutation.isPending}>
              {forgotMutation.isPending ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
            </button>
          </form>

          <button className="auth-switch" type="button" onClick={backToLogin}>
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </section>
      </main>
    );
  }

  const loading = loginMutation.isPending || registerMutation.isPending;
  const destinationMessage = location.pathname.startsWith('/equipment/')
    ? 'กรุณาเข้าสู่ระบบเพื่อดูข้อมูลครุภัณฑ์จาก QR Code หลังเข้าสู่ระบบจะกลับมาหน้านี้อัตโนมัติ'
    : '';

  return (
    <main className="app-shell">
      <section className="welcome-card">
        <AuthHeader title={isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}>
          <p>
            {isLogin
              ? 'กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน'
              : 'สร้างบัญชีผู้ใช้งานใหม่'}
          </p>
        </AuthHeader>
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
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="อย่างน้อย 8 ตัวอักษร"
              minLength={8}
              maxLength={72}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {isLogin && (
            <button className="forgot-link" type="button" onClick={openForgotPassword}>
              ลืมรหัสผ่าน?
            </button>
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
