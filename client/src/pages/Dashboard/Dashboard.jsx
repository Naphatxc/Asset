// Dashboard เป็นโครงหน้าหลัง Login ดูแล state/logic การจัดการผู้ใช้ (เฉพาะ Admin) ของตัวเองทั้งหมด
// นำระบบย่อยต่าง ๆ (ครุภัณฑ์, จัดการผู้ใช้) มาวางรวมกัน
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getUsers, updateUserRole as updateUserRoleRequest } from '../../api/admin-users.js';
import BorrowManager from './components/BorrowManager.jsx';
import DashboardOverview from './components/DashboardOverview.jsx';
import EquipmentManager from './components/EquipmentManager.jsx';
import MyBorrows from './components/MyBorrows.jsx';
import UserTable from './components/UserTable.jsx';

export default function Dashboard({ user, onLogout }) {
  const queryClient = useQueryClient();
  const [adminError, setAdminError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // รายชื่อผู้ใช้เป็นข้อมูลเฉพาะ Admin จึงโหลดหลังทราบ role แล้วเท่านั้น
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: user.role === 'admin',
  });
  const users = usersData?.users ?? [];

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => updateUserRoleRequest(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

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

  return (
    <main className="app-shell">
      <section className="welcome-card dashboard-card">
        <img className="brand-logo" src="/logo.jpg" alt="Mathematics" />
        <p className="eyebrow">Material & Asset Management</p>
        <h1>สวัสดี {user.name}</h1>
        <div className="account-summary">
          <span>{user.email}</span>
          <span className="role-badge">
            {user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
          </span>
        </div>

        {/* ภาพรวม/จัดการผู้ใช้/ยืม-คืนต้องไม่ถูกสร้างใน DOM หากคนที่ Login ไม่ใช่ Admin */}
        {user.role === 'admin' && <DashboardOverview />}

        <EquipmentManager user={user} />

        {user.role === 'admin' ? (
          <>
            <BorrowManager />

            <section className="admin-section">
              <h2>จัดการผู้ใช้งาน</h2>
              {adminError && (
                <p className="error-message">{adminError}</p>
              )}
              <UserTable
                users={users}
                currentUserId={user.user_id}
                updatingUserId={updatingUserId}
                onUpdateRole={updateUserRole}
              />
            </section>
          </>
        ) : (
          <MyBorrows />
        )}

        <button
          className="logout-button"
          type="button"
          onClick={onLogout}
        >
          ออกจากระบบ
        </button>
      </section>
    </main>
  );
}
