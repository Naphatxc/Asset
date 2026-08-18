// จุดเริ่มต้นของ Frontend: นำ App ไปแสดงใน <div id="root"> ของ index.html
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  // StrictMode ช่วยเตือนปัญหาที่พบบ่อยระหว่างพัฒนา React
  <StrictMode>
    {/* BrowserRouter ทำให้ URL /equipment/:code เปิดหน้า React ได้โดยไม่ Reload ทั้งเว็บ */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
