// Dashboard เป็นโครงหน้าหลัง Login ดูแล state/logic การจัดการผู้ใช้ (เฉพาะ Admin) ของตัวเองทั้งหมด
// จัดวางเป็น sidebar + เนื้อหา สลับหัวข้อด้วย tab แทนการเรียงทุก section ต่อกันยาว
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getUsers, updateUserRole as updateUserRoleRequest } from '../../api/admin-users.js';
import BorrowManager from './components/BorrowManager.jsx';
import DashboardOverview from './components/DashboardOverview.jsx';
import EquipmentManager from './components/EquipmentManager.jsx';
import MyBorrows from './components/MyBorrows.jsx';
import RepairManager from './components/RepairManager.jsx';
import UserTable from './components/UserTable.jsx';

const adminTabs = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'equipment', label: 'ครุภัณฑ์' },
  { key: 'borrow', label: 'ยืม-คืน' },
  { key: 'repair', label: 'แจ้งซ่อม' },
  { key: 'users', label: 'ผู้ใช้งาน' },
];

const userTabs = [
  { key: 'equipment', label: 'ครุภัณฑ์' },
  { key: 'borrow', label: 'ยืมของฉัน' },
];

export default function Dashboard({ user, onLogout }) {
  const queryClient = useQueryClient();
  const admin = user.role === 'admin';
  const tabs = admin ? adminTabs : userTabs;
  const [activeTab, setActiveTab] = useState(admin ? 'overview' : 'equipment');
  const [adminError, setAdminError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // รายชื่อผู้ใช้เป็นข้อมูลเฉพาะ Admin จึงโหลดหลังทราบ role แล้วเท่านั้น
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: admin,
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
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-account">
          <img className="brand-logo" src="/logo.jpg" alt="Mathematics" />
          <p className="eyebrow">Material & Asset Management</p>
          <h1>{user.name}</h1>
          <div className="account-summary">
            <span>{user.email}</span>
            <span className="role-badge">
              {admin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
            </span>
          </div>
        </div>

        <nav className="dashboard-nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                tab.key === activeTab
                  ? 'dashboard-nav-item active'
                  : 'dashboard-nav-item'
              }
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <button className="logout-button" type="button" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </aside>

      <main className="dashboard-content">
        {activeTab === 'overview' && admin && <DashboardOverview />}

        {activeTab === 'equipment' && <EquipmentManager user={user} />}

        {activeTab === 'borrow' && (admin ? <BorrowManager /> : <MyBorrows />)}

        {activeTab === 'repair' && admin && <RepairManager />}

        {activeTab === 'users' && admin && (
          <section className="admin-section">
            <h2>จัดการผู้ใช้งาน</h2>
            {adminError && <p className="error-message">{adminError}</p>}
            <UserTable
              users={users}
              currentUserId={user.user_id}
              updatingUserId={updatingUserId}
              onUpdateRole={updateUserRole}
            />
          </section>
        )}
      </main>
    </div>
  );
}
