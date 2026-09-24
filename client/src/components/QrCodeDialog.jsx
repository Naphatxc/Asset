import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

import { buildEquipmentUrl } from '../utils/equipment-qr.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default function QrCodeDialog({ equipment, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const equipmentUrl = useMemo(
    () => buildEquipmentUrl(equipment.equipment_code),
    [equipment.equipment_code],
  );

  useEffect(() => {
    let active = true;

    async function createQrCode() {
      try {
        setError('');
        const dataUrl = await QRCode.toDataURL(equipmentUrl, {
          errorCorrectionLevel: 'H',
          width: 360,
          margin: 2,
          color: {
            dark: '#333333',
            light: '#ffffff',
          },
        });

        if (active) setQrDataUrl(dataUrl);
      } catch {
        if (active) setError('ไม่สามารถสร้าง QR Code ได้');
      }
    }

    createQrCode();

    return () => {
      active = false;
    };
  }, [equipmentUrl]);

  function downloadQrCode() {
    if (!qrDataUrl) return;

    const safeCode = String(equipment.equipment_code).replace(
      /[^a-z0-9_-]/gi,
      '-',
    );
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${safeCode}-qr.png`;
    link.click();
  }

  function printLabel() {
    if (!qrDataUrl) return;

    const printWindow = window.open('', '_blank', 'width=620,height=760');

    if (!printWindow) {
      setError('Browser ปิดกั้นหน้าพิมพ์ กรุณาอนุญาต Pop-up แล้วลองใหม่');
      return;
    }

    printWindow.document.write(`<!doctype html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(equipment.equipment_code)}</title>
          <style>
            @page { size: 90mm 110mm; margin: 7mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; color: #222; }
            .label { width: 100%; text-align: center; border: 2px solid #ed0082; border-radius: 12px; padding: 14px; }
            .brand { margin: 0 0 8px; color: #b43b6b; font-size: 12px; font-weight: 700; }
            img { width: 62mm; height: 62mm; object-fit: contain; }
            h1 { margin: 5px 0; font-size: 18px; }
            p { margin: 4px 0; font-size: 13px; }
          </style>
        </head>
        <body>
          <section class="label">
            <p class="brand">MATERIAL &amp; ASSET MANAGEMENT</p>
            <img src="${qrDataUrl}" alt="QR Code" />
            <h1>${escapeHtml(equipment.equipment_code)}</h1>
            <p>${escapeHtml(equipment.equipment_name)}</p>
            <p>ภาควิชาสถิติประยุกต์</p>
          </section>
          <script>window.addEventListener('load', () => { window.print(); });<\/script>
        </body>
      </html>`);
    printWindow.document.close();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="qr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Equipment QR Code</p>
            <h2 id="qr-dialog-title">ฉลากครุภัณฑ์</h2>
          </div>
          <button
            className="button-secondary"
            type="button"
            onClick={onClose}
          >
            ปิด
          </button>
        </div>

        <div className="qr-label-preview">
          {qrDataUrl ? (
            <img
              className="qr-image"
              src={qrDataUrl}
              alt={`QR Code สำหรับ ${equipment.equipment_code}`}
            />
          ) : (
            !error && <p className="loading-message">กำลังสร้าง QR Code...</p>
          )}
          <strong>{equipment.equipment_code}</strong>
          <span>{equipment.equipment_name}</span>
          <small>{equipmentUrl}</small>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="form-actions qr-actions">
          <button
            className="button-primary"
            type="button"
            disabled={!qrDataUrl}
            onClick={downloadQrCode}
          >
            ดาวน์โหลด PNG
          </button>
          <button
            className="button-secondary"
            type="button"
            disabled={!qrDataUrl}
            onClick={printLabel}
          >
            พิมพ์ฉลาก
          </button>
        </div>
      </section>
    </div>
  );
}
