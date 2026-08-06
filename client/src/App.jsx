import { useEffect, useState } from 'react';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [adminError, setAdminError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState(null);

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

        if (!response.ok) throw new Error(data.message);
        setUsers(data.users);
      } catch (loadError) {
        setAdminError(loadError.message);
      }
    }

    loadUsers();
  }, [user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message ?? 'เข้าสู่ระบบไม่สำเร็จ');
      localStorage.setItem('access_token', data.token);
      setUser(data.user);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }
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

      if (!response.ok) {
        throw new Error(data.message);
      }

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

  function logout() {
    localStorage.removeItem('access_token');
    setUser(null);
    setUsers([]);
    setEmail('');
    setPassword('');
  }

  if (checkingSession) {
    return <main className="app-shell"><p>กำลังตรวจสอบการเข้าสู่ระบบ...</p></main>;
  }

  if (user) {
    return (
      <main className="app-shell">
        <section className="welcome-card dashboard-card">
          <p className="eyebrow">Material & Asset Management</p>
          <h1>สวัสดี {user.name}</h1>
          <p>อีเมล: {user.email}</p>
          <p>สิทธิ์: {user.role}</p>

          {user.role === 'admin' ? (
            <section className="admin-section">
              <h2>จัดการผู้ใช้งาน</h2>
              {adminError && <p className="error-message">{adminError}</p>}
              <div className="table-wrap">
                <table className="user-table">
                  <thead>
                    <tr><th>ชื่อ</th><th>อีเมล</th><th>สิทธิ์</th></tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item.user_id}>
                        <td>{item.name}</td>
                        <td>{item.email}</td>
                        <td>
                          <select
                            value={item.role}
                            disabled={
                              item.user_id === user.user_id ||
                              updatingUserId === item.user_id
                            }
                            onChange={(event) =>
                              updateUserRole(item.user_id, event.target.value)
                            }
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <p>บัญชีของคุณเป็นผู้ใช้งานทั่วไป</p>
          )}

          <button className="logout-button" type="button" onClick={logout}>ออกจากระบบ</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="welcome-card">
        <p className="eyebrow">Material & Asset Management</p>
        <h1>เข้าสู่ระบบ</h1>
        <p>กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>อีเมล
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
          </label>
          <label>รหัสผ่าน
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" required />
          </label>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
        </form>
      </section>
    </main>
  );
}
