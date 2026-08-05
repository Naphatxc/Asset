const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export default function App() {
  return (
    <main className="app-shell">
      <section className="welcome-card">
        <p className="eyebrow">Material & Asset Management</p>
        <h1>ระบบจัดการวัสดุและครุภัณฑ์</h1>
        <p>
          เริ่มต้นระบบสำเร็จแล้ว ขั้นต่อไปคือหน้าเข้าสู่ระบบและการเชื่อมต่อฐานข้อมูล
        </p>
        <a href={`${apiUrl}/api/health`} target="_blank" rel="noreferrer">
          ตรวจสอบสถานะ API
        </a>
      </section>
    </main>
  );
}
