// Dashboard เป็นโครงหน้าหลัง Login ดูแล state/logic การจัดการผู้ใช้ (เฉพาะ Admin) ของตัวเองทั้งหมด
// จัดวางเป็น sidebar + เนื้อหา สลับหัวข้อด้วย tab แทนการเรียงทุก section ต่อกันยาว
// tab ที่เลือกอยู่เก็บใน URL (?tab=) แทน useState เฉยๆ เพราะหน้ารายละเอียดครุภัณฑ์ (/equipment/:code)
// ลิงก์ "กลับหน้ารายการ" กลับมาที่ "/" ซึ่ง remount Dashboard ใหม่ทุกครั้ง — ถ้าเก็บ state ไว้ในคอมโพเนนต์เฉยๆ
// จะรีเซ็ตกลับเป็นแท็บเริ่มต้น (ภาพรวม) เสมอ ไม่ใช่แท็บที่ผู้ใช้มาจาก
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getUsers, updateUserRole as updateUserRoleRequest } from '../../api/admin-users.js';
import ChangePasswordDialog from '../../components/ChangePasswordDialog.jsx';
import { SortSelect, sortRows } from '../../components/ListFilters.jsx';
import PaginationBar, { paginateRows } from '../../components/PaginationBar.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import AuditManager from './components/AuditManager.jsx';
import BorrowManager from './components/BorrowManager.jsx';
import DashboardOverview from './components/DashboardOverview.jsx';
import EquipmentManager from './components/EquipmentManager.jsx';
import MaterialManager from './components/MaterialManager.jsx';
import MyBorrows from './components/MyBorrows.jsx';
import RepairManager from './components/RepairManager.jsx';
import UserTable, { userSortColumns } from './components/UserTable.jsx';

const adminTabs = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'equipment', label: 'ครุภัณฑ์' },
  { key: 'materials', label: 'วัสดุ' },
  { key: 'borrow', label: 'ยืม-คืน' },
  { key: 'repair', label: 'แจ้งซ่อม' },
  { key: 'audit', label: 'ตรวจนับประจำปี' },
  { key: 'users', label: 'ผู้ใช้งาน' },
];

const userTabs = [
  { key: 'equipment', label: 'ครุภัณฑ์' },
  { key: 'materials', label: 'วัสดุ' },
  { key: 'borrow', label: 'ยืมของฉัน' },
  { key: 'repair', label: 'แจ้งซ่อม' },
];

export default function Dashboard({ user, onLogout }) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const admin = user.role === 'admin';
  const tabs = admin ? adminTabs : userTabs;
  const defaultTab = admin ? 'overview' : 'equipment';
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  // เผื่อ URL ถูกแก้มือเป็นแท็บที่ role นี้ไม่มีสิทธิ์เห็น (เช่น user ทั่วไปใส่ ?tab=users เอง)
  const activeTab = tabs.some((tab) => tab.key === requestedTab)
    ? requestedTab
    : defaultTab;

  function selectTab(key) {
    setSearchParams({ tab: key });
  }

  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userSort, setUserSort] = useState({ key: 'name', dir: 'asc' });
  const [changingPassword, setChangingPassword] = useState(false);

  // รายชื่อผู้ใช้เป็นข้อมูลเฉพาะ Admin จึงโหลดหลังทราบ role แล้วเท่านั้น
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: admin,
  });
  const users = usersData?.users ?? [];
  // รายชื่อผู้ใช้ทั้งระบบมีไม่มาก (หลักสิบ) จึงกรองฝั่ง client พอ ไม่ต้องเพิ่ม search param ที่ backend
  const filteredUsers = userSearch.trim()
    ? users.filter((item) =>
        item.name.toLowerCase().includes(userSearch.trim().toLowerCase()),
      )
    : users;
  const { rows: pageUsers, pagination: userPagination } = paginateRows(
    sortRows(filteredUsers, userSortColumns, userSort),
    userPage,
  );

  function changeUserSort(nextSort) {
    setUserSort(nextSort);
    setUserPage(1);
  }

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => updateUserRoleRequest(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  // เปลี่ยน role แล้วให้ query ['admin-users'] invalidate ไปโหลดตารางใหม่เอง
  async function updateUserRole(userId, role) {
    try {
      setUpdatingUserId(userId);
      await updateRoleMutation.mutateAsync({ userId, role });
    } catch (updateError) {
      showError(updateError.message);
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
              onClick={() => selectTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <button
          className="account-button"
          type="button"
          onClick={() => setChangingPassword(true)}
        >
          เปลี่ยนรหัสผ่าน
        </button>

        <button className="logout-button" type="button" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </aside>

      <main className="dashboard-content">
        {activeTab === 'overview' && admin && <DashboardOverview />}

        {activeTab === 'equipment' && <EquipmentManager user={user} />}

        {activeTab === 'materials' && <MaterialManager user={user} />}

        {activeTab === 'borrow' && (admin ? <BorrowManager /> : <MyBorrows />)}

        {activeTab === 'repair' && <RepairManager mine={!admin} />}

        {activeTab === 'audit' && admin && <AuditManager />}

        {activeTab === 'users' && admin && (
          <section className="admin-section">
            <h2>จัดการผู้ใช้งาน</h2>
            <div className="equipment-filters">
              <input
                type="search"
                value={userSearch}
                onChange={(event) => {
                  setUserSearch(event.target.value);
                  setUserPage(1);
                }}
                placeholder="ค้นหาชื่อผู้ใช้งาน"
              />
              <SortSelect
                sortColumns={userSortColumns}
                sort={userSort}
                onSortChange={changeUserSort}
              />
            </div>
            {filteredUsers.length === 0 ? (
              <div className="empty-state">
                <p>ไม่พบผู้ใช้งานที่ตรงกับคำค้นหา</p>
              </div>
            ) : (
              <UserTable
                users={pageUsers}
                currentUserId={user.user_id}
                updatingUserId={updatingUserId}
                onUpdateRole={updateUserRole}
                sort={userSort}
                onSortChange={changeUserSort}
              />
            )}
            <PaginationBar pagination={userPagination} onPageChange={setUserPage} />
          </section>
        )}
      </main>

      {changingPassword && (
        <ChangePasswordDialog
          onClose={() => setChangingPassword(false)}
          onChanged={() => {
            setChangingPassword(false);
            showSuccess('เปลี่ยนรหัสผ่านสำเร็จ');
          }}
        />
      )}
    </div>
  );
}
