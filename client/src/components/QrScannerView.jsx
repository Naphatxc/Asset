// กล้องสแกน QR ในหน้าเว็บ ใช้ qr-scanner แทน BarcodeDetector ของ browser เพราะ Safari บน iPhone ยังไม่มี
// กล้องเปิดได้เฉพาะหน้าที่เป็น HTTPS (หรือ localhost) เท่านั้น เปิดผ่าน IP วง LAN ตอน dev จะขึ้น error ตรงนี้
import QrScanner from 'qr-scanner';
import { useEffect, useRef, useState } from 'react';

function describeCameraError(error) {
  const name = error?.name ?? '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตการเข้าถึงกล้องในการตั้งค่าเบราว์เซอร์';
  }
  if (!window.isSecureContext) {
    return 'เปิดกล้องได้เฉพาะหน้าเว็บที่เป็น HTTPS เท่านั้น';
  }

  return 'ไม่พบกล้องหรือเปิดกล้องไม่ได้ พิมพ์รหัสครุภัณฑ์แทนได้';
}

export default function QrScannerView({ onScan }) {
  const videoRef = useRef(null);
  // เก็บ callback ล่าสุดไว้ใน ref กล้องจะได้ไม่ต้องปิด-เปิดใหม่ทุกครั้งที่ parent render
  const onScanRef = useRef(onScan);
  const [error, setError] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    const scanner = new QrScanner(
      videoRef.current,
      (result) => onScanRef.current(result.data),
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 8,
        returnDetailedScanResult: true,
      },
    );

    // StrictMode (และการกดเปิด-ปิดกล้องเร็วๆ) ทำลายตัวแรกทิ้งระหว่าง start() ยังไม่เสร็จ ตัวนั้นจะ reject
    // ตามมาทีหลัง ต้องไม่เอา error ของตัวที่ถูกทิ้งแล้วมาโชว์ทับกล้องตัวใหม่ที่ทำงานอยู่
    let active = true;
    scanner.start().catch((startError) => {
      if (active) setError(describeCameraError(startError));
    });

    return () => {
      active = false;
      scanner.destroy();
    };
  }, []);

  return (
    <div className="qr-scanner">
      <video ref={videoRef} muted playsInline />
      {error && <p className="qr-scanner-error">{error}</p>}
    </div>
  );
}
