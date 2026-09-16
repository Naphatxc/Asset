import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="app-shell">
      <section className="welcome-card centered-state">
        <p className="eyebrow">404 · Page not found</p>
        <h1>ไม่พบหน้าที่ต้องการ</h1>
        <p>URL นี้ไม่มีอยู่ในระบบ กรุณากลับไปหน้ารายการครุภัณฑ์</p>
        <Link className="button-link button-primary" to="/">
          กลับหน้าหลัก
        </Link>
      </section>
    </main>
  );
}
