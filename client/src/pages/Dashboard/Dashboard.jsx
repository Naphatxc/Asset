// Dashboard เป็นโครงหน้าหลัง Login ดูแล state/logic การจัดการผู้ใช้ (เฉพาะ Admin) ของตัวเองทั้งหมด
// จัดวางเป็น sidebar + เนื้อหา สลับหัวข้อด้วย tab แทนการเรียงทุก section ต่อกันยาว
// tab ที่เลือกอยู่เก็บใน URL (?tab=) แทน useState เฉยๆ เพราะหน้ารายละเอียดครุภัณฑ์ (/equipment/:code)
// ลิงก์ "กลับหน้ารายการ" กลับมาที่ "/" ซึ่ง remount Dashboard ใหม่ทุกครั้ง — ถ้าเก็บ state ไว้ในคอมโพเนนต์เฉยๆ
// จะรีเซ็ตกลับเป็นแท็บเริ่มต้น (ภาพรวม) เสมอ ไม่ใช่แท็บที่ผู้ใช้มาจาก
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  createUser as createUserRequest,
  deleteUser as deleteUserRequest,
  getUsers,
  updateUserRole as updateUserRoleRequest,
} from '../../api/admin-users.js';
import ChangePasswordDialog from '../../components/ChangePasswordDialog.jsx';
import CreateUserDialog from '../../components/CreateUserDialog.jsx';
import { SortSelect, matchesSearch, sortRows } from '../../components/ListFilters.jsx';
import PaginationBar, { paginateRows } from '../../components/PaginationBar.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import AuditManager from './components/AuditManager.jsx';
import BorrowManager from './components/BorrowManager.jsx';
import DashboardOverview from './components/DashboardOverview.jsx';
import DocumentManager from './components/DocumentManager.jsx';
import DocumentSubmissions from './components/DocumentSubmissions.jsx';
import EquipmentManager from './components/EquipmentManager.jsx';
import MaterialManager from './components/MaterialManager.jsx';
import MyBorrows from './components/MyBorrows.jsx';
import RepairManager from './components/RepairManager.jsx';
import RoomBooking from './components/RoomBooking.jsx';
import UserTable, { userSortColumns } from './components/UserTable.jsx';

// ลำดับเมนู: ภาพรวม -> ของในคลัง (ครุภัณฑ์/วัสดุ) -> บริการประจำวัน (ยืม-คืน/จองห้อง/แจ้งซ่อม/เอกสาร)
// -> งานจัดการของ Admin (ตรวจนับ/ผู้ใช้งาน) อยู่ท้ายสุด
const adminTabs = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'equipment', label: 'ครุภัณฑ์' },
  { key: 'materials', label: 'วัสดุ' },
  { key: 'borrow', label: 'ยืม-คืน' },
  { key: 'room', label: 'จองห้อง' },
  { key: 'repair', label: 'แจ้งซ่อม' },
  { key: 'documents', label: 'เอกสาร' },
  { key: 'audit', label: 'ตรวจนับประจำปี' },
  { key: 'users', label: 'ผู้ใช้งาน' },
];

// แท็บ idp / obe3 / obe5 คือหน้าส่งเอกสาร key ต้องตรงกับประเภทเอกสารใน utils/documents.js (DOCUMENT_TYPES)
// ฝั่ง Admin เห็นเอกสารที่ทุกคนส่งมารวมกันในแท็บ "เอกสาร" แทน
const userTabs = [
  { key: 'room', label: 'จองห้อง' },
  { key: 'idp', label: 'IDP' },
  { key: 'obe3', label: 'OBE 3' },
  { key: 'obe5', label: 'OBE 5' },
];

export default function Dashboard({ user, onLogout }) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const admin = user.role === 'admin';
  // อีเมลยาวเกินความกว้าง sidebar ให้ขึ้นบรรทัดใหม่หลัง @
  const emailBreak = user.email.indexOf('@') + 1;
  const tabs = admin ? adminTabs : userTabs;
  const defaultTab = admin ? 'overview' : 'room';
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
  // '' = ทุก role
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userSort, setUserSort] = useState({ key: 'name', dir: 'asc' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  // รายชื่อผู้ใช้เป็นข้อมูลเฉพาะ Admin จึงโหลดหลังทราบ role แล้วเท่านั้น
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: admin,
  });
  const users = usersData?.users ?? [];
  // รายชื่อผู้ใช้ทั้งระบบมีไม่มาก (หลักสิบ) จึงกรองฝั่ง client พอ ไม่ต้องเพิ่ม search param ที่ backend
  const filteredUsers = users.filter(
    (item) =>
      (!userRoleFilter || item.role === userRoleFilter) &&
      matchesSearch(userSearch, item.name, item.email),
  );
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

  const createUserMutation = useMutation({
    mutationFn: createUserRequest,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setCreatingUser(false);
      showSuccess(`เพิ่มผู้ใช้ ${data.user.name} แล้ว`);
    },
  });

  function openCreateUser() {
    createUserMutation.reset();
    setCreatingUser(true);
  }

  const deleteUserMutation = useMutation({
    mutationFn: (item) => deleteUserRequest(item.user_id),
    onSuccess: (_data, item) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      showSuccess(`ลบผู้ใช้ ${item.name} แล้ว`);
    },
    onError: (deleteError) => showError(deleteError.message),
    onSettled: () => setConfirmingDeleteId(null),
  });

  // กดครั้งแรกแค่เปลี่ยนปุ่มเป็น "ยืนยันลบ" กดซ้ำจึงลบจริง
  function deleteUser(item) {
    if (confirmingDeleteId !== item.user_id) {
      setConfirmingDeleteId(item.user_id);
      return;
    }
    deleteUserMutation.mutate(item);
  }

  return (
    <div className="dashboard-shell">
      {/* ซ่อนไว้จนกด Tab ครั้งแรก ให้คนใช้คีย์บอร์ดข้ามเมนูซ้ายไปที่เนื้อหาได้เลย */}
      <a className="skip-link" href="#main-content">
        ข้ามไปเนื้อหาหลัก
      </a>
      <aside className="dashboard-sidebar">
        <div className="dashboard-account">
          <img className="brand-logo" src="/logo.png" alt="สถิติประยุกต์ Applied Statistics" />
          <p className="eyebrow">Material & Asset Management</p>
          <h1>{user.name}</h1>
          <div className="account-summary">
            {/* ใช้ <wbr> ไม่ใช่ zero-width space เพราะ <wbr> ไม่ติดไปตอน copy อีเมล */}
            <span className="account-email">
              {user.email.slice(0, emailBreak)}
              <wbr />
              {user.email.slice(emailBreak)}
            </span>
            <span className="role-badge">
              {admin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
            </span>
          </div>
        </div>

        <nav className="dashboard-nav" aria-label="เมนูหลัก">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              // บอกโปรแกรมอ่านหน้าจอว่าแท็บไหนเปิดอยู่ (สีพื้นอย่างเดียวคนตาบอดไม่รู้)
              aria-current={tab.key === activeTab ? 'page' : undefined}
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

      <main className="dashboard-content" id="main-content" tabIndex={-1}>
        {activeTab === 'overview' && admin && <DashboardOverview user={user} />}

        {activeTab === 'equipment' && <EquipmentManager user={user} />}

        {activeTab === 'materials' && <MaterialManager user={user} />}

        {activeTab === 'borrow' && (admin ? <BorrowManager /> : <MyBorrows />)}

        {activeTab === 'repair' && <RepairManager mine={!admin} />}

        {activeTab === 'room' && <RoomBooking user={user} />}

        {activeTab === 'documents' && admin && <DocumentManager />}

        {/* สามแท็บนี้ใช้ component เดียวกัน key ทำให้สลับแท็บแล้วฟอร์ม (ไฟล์ที่เลือก/หมายเหตุ) เริ่มใหม่ ไม่ค้างข้ามประเภท */}
        {(activeTab === 'idp' || activeTab === 'obe3' || activeTab === 'obe5') && (
          <DocumentSubmissions key={activeTab} type={activeTab} />
        )}

        {activeTab === 'audit' && admin && <AuditManager />}

        {activeTab === 'users' && admin && (
          <section className="admin-section">
            <h2>จัดการผู้ใช้งาน</h2>
            <div className="equipment-filters">
              <input
                type="search"
                aria-label="ค้นหาชื่อหรืออีเมล"
                value={userSearch}
                onChange={(event) => {
                  setUserSearch(event.target.value);
                  setUserPage(1);
                }}
                placeholder="ค้นหาชื่อหรืออีเมล"
              />
              <select
                value={userRoleFilter}
                onChange={(event) => {
                  setUserRoleFilter(event.target.value);
                  setUserPage(1);
                }}
                aria-label="กรองตามสิทธิ์"
              >
                <option value="">ทุกสิทธิ์</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <SortSelect
                sortColumns={userSortColumns}
                sort={userSort}
                onSortChange={changeUserSort}
              />
              <button className="button-primary" type="button" onClick={openCreateUser}>
                + เพิ่มผู้ใช้
              </button>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="empty-state">
                <p>ไม่พบผู้ใช้งานที่ตรงกับตัวกรอง</p>
              </div>
            ) : (
              <UserTable
                users={pageUsers}
                currentUserId={user.user_id}
                updatingUserId={updatingUserId}
                onUpdateRole={updateUserRole}
                confirmingDeleteId={confirmingDeleteId}
                deletingUserId={
                  deleteUserMutation.isPending ? deleteUserMutation.variables?.user_id : null
                }
                onDelete={deleteUser}
                onCancelDelete={() => setConfirmingDeleteId(null)}
                sort={userSort}
                onSortChange={changeUserSort}
              />
            )}
            <PaginationBar pagination={userPagination} onPageChange={setUserPage} />
          </section>
        )}
      </main>

      {creatingUser && (
        <CreateUserDialog
          submitting={createUserMutation.isPending}
          error={createUserMutation.error?.message}
          onSubmit={(values) => createUserMutation.mutate(values)}
          onClose={() => setCreatingUser(false)}
        />
      )}

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
