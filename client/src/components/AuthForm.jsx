// Component นี้แสดงเฉพาะหน้าตา Form ส่วน state และการยิง API อยู่ใน App.jsx
export default function AuthForm({
  authMode,
  name,
  email,
  password,
  error,
  successMessage,
  loading,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onSwitchMode,
}) {
  // ใช้ตัวแปรเดียวควบคุมว่าต้องแสดงช่องชื่อและข้อความแบบ Login หรือ Register
  const isLogin = authMode === 'login';

  return (
    <main className="app-shell">
      <section className="welcome-card">
        <p className="eyebrow">Material & Asset Management</p>
        <h1>{isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</h1>
        <p>
          {isLogin
            ? 'กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน'
            : 'สร้างบัญชีผู้ใช้งานใหม่'}
        </p>

        <form className="login-form" onSubmit={onSubmit}>
          {!isLogin && (
            <label>
              ชื่อ-นามสกุล
              <input
                type="text"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
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
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="name@example.com"
              maxLength={255}
              autoComplete="email"
              required
            />
          </label>

          <label>
            รหัสผ่าน
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="อย่างน้อย 8 ตัวอักษร"
              minLength={8}
              maxLength={72}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {successMessage && (
            <p className="success-message">{successMessage}</p>
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
          onClick={onSwitchMode}
        >
          {isLogin
            ? 'ยังไม่มีบัญชี? สมัครสมาชิก'
            : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
      </section>
    </main>
  );
}
