// หัวการ์ดของหน้าที่ยังไม่ login (เข้าสู่ระบบ/สมัครสมาชิก/ลืมรหัสผ่าน/ตั้งรหัสผ่านใหม่) ให้โลโก้และชื่อหน่วยงานหน้าตาเหมือนกันทุกหน้า
// children คือคำอธิบายใต้หัวข้อ ซึ่งแต่ละหน้าไม่เหมือนกัน
export default function AuthHeader({ title, children }) {
  return (
    <header className="auth-header">
      <img className="brand-logo" src="/logo.jpg" alt="Mathematics" />
      <div className="auth-organization">
        <p className="auth-department">ภาควิชาสถิติประยุกต์</p>
        <p className="auth-faculty">
          คณะวิทยาศาสตร์ประยุกต์
          <br />
          มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ
        </p>
      </div>
      <p className="eyebrow">Material & Asset Management</p>
      <h1>{title}</h1>
      {children}
    </header>
  );
}
