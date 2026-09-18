// Toast แจ้งเตือนแบบ popup มุมขวาบน หายไปเองหลังไม่กี่วินาที ใช้แทนข้อความ success/error ที่เดิมค้างอยู่
// ในหน้าจอจนกว่าจะมี action ถัดไปมาเคลียร์ทิ้ง — เรียกผ่าน useToast() แทน useState ท้องถิ่นของแต่ละ component
import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

let nextToastId = 1;

// error อยู่นานกว่า success เพราะมักมีรายละเอียดที่ต้องอ่าน/แก้ไขตาม ไม่ใช่แค่รับทราบผ่านๆ
const DURATIONS_MS = { success: 4000, error: 6000 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));

    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (type, message) => {
      if (!message) return;

      const id = nextToastId++;
      setToasts((current) => [...current, { id, type, message }]);

      const timer = setTimeout(() => dismissToast(id), DURATIONS_MS[type] ?? 4000);
      timers.current.set(id, timer);
    },
    [dismissToast],
  );

  const value = {
    showSuccess: (message) => showToast('success', message),
    showError: (message) => showToast('error', message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="ปิดการแจ้งเตือน"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast ต้องถูกเรียกภายใน <ToastProvider>');
  }

  return context;
}
