// App ดูแลเรื่องบัญชีผู้ใช้และ Session ส่วนงานครุภัณฑ์แยกไปอยู่ใน EquipmentManager
import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import AuthForm from './components/AuthForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import EquipmentDetailPage from './components/EquipmentDetailPage.jsx';
import NotFoundPage from './components/NotFoundPage.jsx';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export default function App() {
  const location = useLocation();
  // State ของฟอร์ม Login/Register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  // State สำหรับข้อความและสถานะการโหลดของหน้า Authentication/Admin
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [name, setName] = useState('');

  // เมื่อเปิดหรือ Refresh เว็บ ให้ใช้ Token เดิมถาม /me ว่ายัง Login อยู่หรือไม่
  useEffect(() => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      setCheckingSession(false);
      return;
    }

    async function loadCurrentUser() {
      try {
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.message);
        setUser(data.user);
      } catch {
        localStorage.removeItem('access_token');
        setUser(null);
      } finally {
        setCheckingSession(false);
      }
    }

    loadCurrentUser();
  }, []);

  // รายชื่อผู้ใช้เป็นข้อมูลเฉพาะ Admin จึงโหลดหลังทราบ role แล้วเท่านั้น
  useEffect(() => {
    if (user?.role !== 'admin') {
      setUsers([]);
      return;
    }

    async function loadUsers() {
      try {
        setAdminError('');
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${apiUrl}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (response.status === 401) {
          clearSession();
          return;
        }
        if (!response.ok) throw new Error(data.message);
        setUsers(data.users);
      } catch (loadError) {
        setAdminError(loadError.message);
      }
    }

    loadUsers();
  }, [user]);

  // ล้างทั้ง Token และข้อมูลในหน่วยความจำ ใช้ร่วมกันตอน Logout/Token หมดอายุ
  function clearSession() {
    localStorage.removeItem('access_token');
    setUser(null);
    setUsers([]);
  }

  // Login และ Register ใช้ฟอร์มเดียวกัน แต่เลือก endpoint จาก authMode
  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const endpoint =
        authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const requestBody =
        authMode === 'login'
          ? { email, password }
          : { name, email, password };
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? 'ไม่สามารถดำเนินการได้');
      }
      if (authMode === 'register') {
        setAuthMode('login');
        setName('');
        setPassword('');
        setSuccessMessage('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
        return;
      }

      localStorage.setItem('access_token', data.token);
      setUser(data.user);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  // เปลี่ยน role แล้วอัปเดตเฉพาะแถวที่เปลี่ยน ไม่จำเป็นต้องโหลดทั้งตารางใหม่
  async function updateUserRole(userId, role) {
    try {
      setAdminError('');
      setUpdatingUserId(userId);
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${apiUrl}/api/admin/users/${userId}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role }),
        },
      );
      const data = await response.json();

      if (response.status === 401) {
        clearSession();
        return;
      }
      if (!response.ok) throw new Error(data.message);

      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.user_id === userId
            ? { ...item, role: data.user.role }
            : item,
        ),
      );
    } catch (updateError) {
      setAdminError(updateError.message);
    } finally {
      setUpdatingUserId(null);
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

  function logout() {
    clearSession();
    setEmail('');
    setPassword('');
  }

  // ระหว่างตรวจ Token ยังไม่ควรแสดงหน้า Login เพราะหน้าจะกระพริบ
  if (checkingSession) {
    return (
      <main className="app-shell">
        <p>กำลังตรวจสอบการเข้าสู่ระบบ...</p>
      </main>
    );
  }

  // มี user = ผ่านการ Login แล้ว จึงแสดง Dashboard
  if (user) {
    return (
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              user={user}
              users={users}
              adminError={adminError}
              updatingUserId={updatingUserId}
              onUpdateUserRole={updateUserRole}
              onSessionExpired={clearSession}
              onLogout={logout}
            />
          }
        />
        <Route
          path="/equipment/:code"
          element={
            <EquipmentDetailPage
              user={user}
              onUnauthorized={clearSession}
              onLogout={logout}
            />
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    );
  }

  return (
    <AuthForm
      authMode={authMode}
      name={name}
      email={email}
      password={password}
      error={error}
      successMessage={successMessage}
      loading={loading}
      onNameChange={setName}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      onSwitchMode={switchAuthMode}
      destinationMessage={
        location.pathname.startsWith('/equipment/')
          ? 'กรุณาเข้าสู่ระบบเพื่อดูข้อมูลครุภัณฑ์จาก QR Code หลังเข้าสู่ระบบจะกลับมาหน้านี้อัตโนมัติ'
          : ''
      }
    />
  );
}
