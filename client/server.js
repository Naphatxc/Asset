// Server ของ Frontend บน production: เสิร์ฟไฟล์ใน dist/ และส่งต่อ /api/* ไปยัง Express API
// ต้อง proxy แทนการให้ browser ยิงตรงไปที่ API เพราะ client/server อยู่คนละ *.up.railway.app ซึ่งนับเป็น
// คนละ site — cookie ของ API จึงเป็น third-party cookie ที่ Safari/ทุก browser บน iOS บล็อกทิ้งเสมอ
// (login ตอบ 200 แต่ cookie ไม่ถูกเก็บ โทรศัพท์จึง login ไม่ติด) พอผ่าน proxy แล้ว browser เห็นเป็น origin เดียวกัน
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const port = Number(process.env.PORT ?? 4173);
const apiTarget = process.env.API_PROXY_TARGET;

if (!apiTarget) {
  throw new Error('API_PROXY_TARGET is required, e.g. https://your-api.up.railway.app');
}

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const app = express();

// ใช้ pathFilter แทน app.use('/api', ...) เพราะแบบหลัง Express จะตัด /api ออกจาก path ก่อนส่งต่อ
// changeOrigin: Railway เลือก service ปลายทางจาก Host header จึงต้องเปลี่ยนเป็น host ของ API
app.use(
  createProxyMiddleware({
    target: apiTarget,
    changeOrigin: true,
    xfwd: true,
    pathFilter: '/api',
  }),
);

app.use(express.static(distDir, { index: false }));

// SPA fallback: path อย่าง /equipment/:code (URL ใน QR) ต้องได้ index.html ให้ React Router จัดการต่อ
app.get('/{*splat}', (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Frontend listening on :${port}, proxying /api to ${apiTarget}`);
});
