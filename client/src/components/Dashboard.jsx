// Dashboard เป็นโครงหน้าหลัง Login แล้วนำระบบย่อยต่าง ๆ มาวางรวมกัน
import EquipmentManager from './EquipmentManager.jsx';
import UserTable from './UserTable.jsx';

export default function Dashboard({
  user,
  users,
  adminError,
  updatingUserId,
  onUpdateUserRole,
  onSessionExpired,
  onLogout,
}) {
  return (
    <main className="app-shell">
      <section className="welcome-card dashboard-card">
        <p className="eyebrow">Material & Asset Management</p>
        <h1>สวัสดี {user.name}</h1>
        <div className="account-summary">
          <span>{user.email}</span>
          <span className="role-badge">
            {user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
          </span>
        </div>

        <EquipmentManager
          user={user}
          onUnauthorized={onSessionExpired}
        />

        {/* ตารางจัดการผู้ใช้ต้องไม่ถูกสร้างใน DOM หากคนที่ Login ไม่ใช่ Admin */}
        {user.role === 'admin' ? (
          <section className="admin-section">
            <h2>จัดการผู้ใช้งาน</h2>
            {adminError && (
              <p className="error-message">{adminError}</p>
            )}
            <UserTable
              users={users}
              currentUserId={user.user_id}
              updatingUserId={updatingUserId}
              onUpdateRole={onUpdateUserRole}
            />
          </section>
        ) : (
          <p className="user-note">
            บัญชีของคุณสามารถดูรายการและรายละเอียดครุภัณฑ์ได้
          </p>
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
