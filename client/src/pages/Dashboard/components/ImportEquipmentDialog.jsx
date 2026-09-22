// นำเข้าครุภัณฑ์หลายรายการจากไฟล์ JSON (สร้างด้วย npm --workspace server run export:equipment)
// ขั้นตอน: เลือกไฟล์ -> ดูสรุปก่อนนำเข้า -> นำเข้า -> ดูผล (สร้างกี่รายการ / ข้ามรหัสที่มีอยู่แล้วกี่รายการ)
// ไฟล์ผิดรูปแบบตรวจเจอตั้งแต่เลือกไฟล์ ส่วนข้อมูลรายแถว server ตรวจทั้งไฟล์ก่อน ผิดแถวเดียวก็ไม่นำเข้าเลย
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { importEquipment } from '../../../api/equipment.js';

const EXPECTED_FORMAT = 'asset-equipment-v1';

async function readImportFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ .json ที่ได้จากการ export ครุภัณฑ์');
  }

  if (parsed?.format !== EXPECTED_FORMAT || !Array.isArray(parsed.items)) {
    throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ export ครุภัณฑ์ของระบบนี้');
  }
  if (parsed.items.length === 0) {
    throw new Error('ไฟล์นี้ไม่มีรายการครุภัณฑ์');
  }

  const categories = new Map();
  for (const item of parsed.items) {
    const name = String(item?.category_name ?? '').trim() || '(ไม่มีหมวดหมู่)';
    categories.set(name, (categories.get(name) ?? 0) + 1);
  }

  return {
    items: parsed.items,
    exportedAt: parsed.exported_at,
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
    withLocation: parsed.items.filter((item) => item?.location_name).length,
  };
}

export default function ImportEquipmentDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [fileError, setFileError] = useState('');

  const mutation = useMutation({
    mutationFn: () => importEquipment(preview.items),
    onSuccess: () => {
      // หมวดหมู่/สถานที่อาจถูกสร้างเพิ่ม และรายการครุภัณฑ์/ตัวเลือกในฟอร์มยืม-ซ่อมเปลี่ยนหมด
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFileName(file.name);
    setPreview(null);
    setFileError('');
    mutation.reset();

    try {
      setPreview(await readImportFile(file));
    } catch (error) {
      setFileError(error.message);
    }
  }

  const result = mutation.data;
  const rowErrors = mutation.error?.data?.errors ?? [];

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <section
        className="repair-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-equipment-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Import</p>
            <h2 id="import-equipment-title">นำเข้าครุภัณฑ์จากไฟล์</h2>
          </div>
          <button
            className="button-secondary"
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            ปิด
          </button>
        </div>

        {result ? (
          <div className="import-result">
            <p className="success-message">{result.message}</p>
            <ul>
              <li>สร้างใหม่ {result.created} รายการ</li>
              {result.skipped.length > 0 && (
                <li>
                  ข้าม {result.skipped.length} รายการ เพราะมีรหัสนี้ในระบบอยู่แล้ว
                  {result.skipped.length <= 20 && `: ${result.skipped.join(', ')}`}
                </li>
              )}
              {result.categories_created.length > 0 && (
                <li>สร้างหมวดหมู่ใหม่: {result.categories_created.join(', ')}</li>
              )}
              {result.locations_created.length > 0 && (
                <li>สร้างสถานที่ใหม่: {result.locations_created.join(', ')}</li>
              )}
            </ul>
            <div className="form-actions">
              <button className="button-primary" type="button" onClick={onClose}>
                เสร็จสิ้น
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="user-note">
              ใช้ไฟล์ .json ที่ได้จากการ export ครุภัณฑ์ รหัสที่มีในระบบอยู่แล้วจะถูกข้าม นำเข้าไฟล์เดิมซ้ำจึงไม่เกิดของซ้ำ
              ของที่นำเข้าจะมีสถานะ "พร้อมใช้งาน" ทั้งหมด
            </p>

            <label className="import-file-picker">
              <input
                type="file"
                accept=".json,application/json"
                onChange={chooseFile}
                disabled={mutation.isPending}
              />
              <span className="button-secondary">เลือกไฟล์</span>
              <span className="import-file-name">{fileName || 'ยังไม่ได้เลือกไฟล์'}</span>
            </label>

            {fileError && <p className="error-message">{fileError}</p>}

            {preview && (
              <div className="import-preview">
                <p>
                  <strong>{preview.items.length.toLocaleString('th-TH')}</strong> รายการ
                  {preview.exportedAt &&
                    ` · export เมื่อ ${new Date(preview.exportedAt).toLocaleString('th-TH')}`}
                  {' · '}
                  {preview.withLocation > 0
                    ? `มีสถานที่ ${preview.withLocation} รายการ`
                    : 'ไม่มีข้อมูลสถานที่ (ไปตั้งตอนตรวจนับได้)'}
                </p>
                <ul className="import-category-list">
                  {preview.categories.map(([name, count]) => (
                    <li key={name}>
                      {name} <strong>{count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mutation.error && (
              <div className="error-message">
                {mutation.error.message}
                {rowErrors.length > 0 && (
                  <ul className="import-errors">
                    {rowErrors.slice(0, 20).map((rowError) => (
                      <li key={rowError.row}>
                        แถว {rowError.row}
                        {rowError.code ? ` (${rowError.code})` : ''}: {rowError.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="form-actions">
              <button
                className="button-primary"
                type="button"
                disabled={!preview || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending
                  ? 'กำลังนำเข้า... (อาจใช้เวลาสักครู่)'
                  : preview
                    ? `นำเข้า ${preview.items.length.toLocaleString('th-TH')} รายการ`
                    : 'นำเข้า'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
