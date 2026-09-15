// App ดูแลเรื่องบัญชีผู้ใช้และ Session ส่วนงานครุภัณฑ์แยกไปอยู่ใน EquipmentManager
// Session มาจาก query ['auth','me'] — กลายเป็น null อัตโนมัติเมื่อเจอ 401 (ดู main.jsx: handleAuthError)
// จึงไม่ต้องส่ง onUnauthorized/onSessionExpired ไล่ผ่าน prop หลายชั้นเหมือนเดิมอีกต่อไป
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import {
  getUsers,
  updateUserRole as updateUserRoleRequest,
} from './api/admin-users.js';
import {
  getCurrentUser,
  login,
  logout as logoutRequest,
  register,
} from './api/auth.js';
import AuthForm from './components/AuthForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import EquipmentDetailPage from './components/EquipmentDetailPage.jsx';
import NotFoundPage from './components/NotFoundPage.jsx';

export default function App() {
  const location = useLocation();
  const queryClient = useQueryClient();
  // State ของฟอร์ม Login/Register (UI-only — ข้อมูลจริงมาจาก query/mutation ด้านล่าง)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [name, setName] = useState('');

  // เช็ค session ตอนโหลด/Refresh หน้าเว็บ cookie จะแนบไปเองถ้ามี (retry:false ตั้งไว้ที่ QueryClient กลาง)
  const { data: meData, isLoading: checkingSession } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
  });
  const user = meData?.user ?? null;

  // รายชื่อผู้ใช้เป็นข้อมูลเฉพาะ Admin จึงโหลดหลังทราบ role แล้วเท่านั้น
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: user?.role === 'admin',
  });
  const users = usersData?.users ?? [];

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      // ตั้งค่า cache ตรงๆ แทนการยิง /me ซ้ำ เพราะ response ของ login ก็มี user อยู่แล้ว
      queryClient.setQueryData(['auth', 'me'], { user: data.user });
    },
  });

  const registerMutation = useMutation({ mutationFn: register });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => updateUserRoleRequest(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

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

  // เปลี่ยน role แล้วให้ query ['admin-users'] invalidate ไปโหลดตารางใหม่เอง
  async function updateUserRole(userId, role) {
    try {
      setAdminError('');
      setUpdatingUserId(userId);
      await updateRoleMutation.mutateAsync({ userId, role });
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

  // เรียก /api/auth/logout ให้ server ล้าง cookie ก่อน แล้วค่อยล้าง cache ฝั่งนี้ — ทำ best-effort
  // คือถึง request ล้มเหลว (เช่น server ล่ม) ก็ยังล้าง session ให้ UI กลับไปหน้า Login ได้ตามปกติ
  async function logout() {
    try {
      await logoutRequest();
    } catch {
      // เพิกเฉย: cookie อาจหมดอายุอยู่แล้วหรือ network มีปัญหา ไม่ควรบล็อกไม่ให้ผู้ใช้ออกจากระบบ
    }

    queryClient.setQueryData(['auth', 'me'], null);
    queryClient.removeQueries({ queryKey: ['admin-users'] });
    setEmail('');
    setPassword('');
  }

  // ระหว่างตรวจ Session ยังไม่ควรแสดงหน้า Login เพราะหน้าจะกระพริบ
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
              onLogout={logout}
            />
          }
        />
        <Route
          path="/equipment/:code"
          element={<EquipmentDetailPage user={user} onLogout={logout} />}
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
      loading={loginMutation.isPending || registerMutation.isPending}
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
