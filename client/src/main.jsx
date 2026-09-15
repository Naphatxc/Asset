// จุดเริ่มต้นของ Frontend: นำ App ไปแสดงใน <div id="root"> ของ index.html
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApiError } from './api/http.js';
import App from './App.jsx';
import './styles.css';

// 401 = session หมดอายุ/ยังไม่ login จัดการรวมจุดเดียวที่นี่ แทนการเช็ค error.status ในทุก component
// ครอบทั้ง query และ mutation เพราะ action เช่นสร้าง/แก้ไขครุภัณฑ์ก็เจอ cookie หมดอายุระหว่างใช้งานได้เหมือนกัน
function handleAuthError(error) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(['auth', 'me'], null);
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleAuthError }),
  mutationCache: new MutationCache({ onError: handleAuthError }),
  defaultOptions: {
    // 401 (ยังไม่ login) เป็นเรื่องปกติตอนเปิดเว็บครั้งแรก ไม่ควร retry ซ้ำเหมือน error อื่น
    queries: { retry: false },
  },
});

createRoot(document.getElementById('root')).render(
  // StrictMode ช่วยเตือนปัญหาที่พบบ่อยระหว่างพัฒนา React
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* BrowserRouter ทำให้ URL /equipment/:code เปิดหน้า React ได้โดยไม่ Reload ทั้งเว็บ */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
