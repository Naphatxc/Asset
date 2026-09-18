// App ดูแลเรื่อง Session และ Routing เท่านั้น ไม่มี logic เฉพาะหน้าใดหน้าหนึ่งอยู่ที่นี่
// Login/Register อยู่ใน LoginPage, จัดการผู้ใช้ (Admin) อยู่ใน Dashboard ทั้งหมด
// Session มาจาก query ['auth','me'] — กลายเป็น null อัตโนมัติเมื่อเจอ 401 (ดู main.jsx: handleAuthError)
// จึงไม่ต้องส่ง onUnauthorized/onSessionExpired ไล่ผ่าน prop หลายชั้นเหมือนเดิมอีกต่อไป
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { getCurrentUser, logout as logoutRequest } from './api/auth.js';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import EquipmentDetailPage from './pages/EquipmentDetailPage/EquipmentDetailPage.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage.jsx';

export default function App() {
  const queryClient = useQueryClient();

  // เช็ค session ตอนโหลด/Refresh หน้าเว็บ cookie จะแนบไปเองถ้ามี (retry:false ตั้งไว้ที่ QueryClient กลาง)
  const { data: meData, isLoading: checkingSession } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
  });
  const user = meData?.user ?? null;

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
        <Route path="/" element={<Dashboard user={user} onLogout={logout} />} />
        <Route
          path="/equipment/:code"
          element={<EquipmentDetailPage user={user} />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    );
  }

  return <LoginPage />;
}
