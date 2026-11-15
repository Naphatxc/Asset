// Popup ให้ Admin ตั้งชื่อที่แสดงของเอกสารทั้ง 3 ประเภท (เดิม IDP / OBE 3 / OBE 5)
// - ชื่อสั้น: ป้ายบนแท็บเมนูของผู้ใช้ ปุ่ม และหัวเรื่องอีเมล
// - ชื่อเต็ม: หัวหน้าส่งเอกสาร และเนื้อความในอีเมล
// เปลี่ยนแค่ชื่อ พฤติกรรมเดิมทุกอย่าง: ประเภทแรกยังส่งไป-กลับมีการตรวจ สองประเภทหลังยังส่งอย่างเดียว
// เอกสารที่ส่งไปแล้วไม่ต้องย้ายข้อมูล เพราะเก็บเป็นรหัสประเภท ชื่อใหม่ขึ้นทุกที่ทันที
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { updateDocumentType } from '../../../api/documents.js';
import { useToast } from '../../../components/ToastProvider.jsx';
import { useModal } from '../../../hooks/useModal.js';

// ต้องตรงกับ server (document.validator.js / @db.VarChar ใน schema.prisma)
const MAX_LABEL_LENGTH = 50;
const MAX_TITLE_LENGTH = 150;

export default function DocumentTypeNamesDialog({ documentTypes, onClose }) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  // ค่าในฟอร์มของแต่ละประเภท เริ่มจากชื่อปัจจุบัน
  const [names, setNames] = useState(() =>
    Object.fromEntries(
      Object.entries(documentTypes).map(([key, type]) => [key, { label: type.label, title: type.title }]),
    ),
  );

  function changeName(key, field, value) {
    setNames((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  }

  // บันทึกเฉพาะประเภทที่แก้จริง ทีละรายการ (มีแค่ 3 ประเภท)
  const saveMutation = useMutation({
    mutationFn: async (changedKeys) => {
      for (const key of changedKeys) {
        await updateDocumentType(key, {
          label: names[key].label.trim(),
          title: names[key].title.trim(),
        });
      }
    },
    onSuccess: () => {
      showSuccess('บันทึกชื่อเอกสารแล้ว');
      onClose();
    },
    onError: (error) => showError(error.message),
    // ถึงบางรายการบันทึกไม่ผ่าน รายการก่อนหน้าก็บันทึกไปแล้ว โหลดชื่อใหม่ทุกครั้ง
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['document-types'] }),
  });

  const dialogRef = useModal(() => {
    if (!saveMutation.isPending) onClose();
  });

  function submit(event) {
    event.preventDefault();
    const changedKeys = Object.keys(names).filter(
      (key) =>
        names[key].label.trim() !== documentTypes[key].label ||
        names[key].title.trim() !== documentTypes[key].title,
    );

    if (changedKeys.length === 0) {
      onClose();
      return;
    }
    saveMutation.mutate(changedKeys);
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={saveMutation.isPending ? undefined : onClose}
    >
      <section
        className="repair-dialog"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby="document-type-names-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Documents</p>
            <h2 id="document-type-names-title">ตั้งชื่อเอกสาร</h2>
          </div>
        </div>

        <form onSubmit={submit}>
          {Object.entries(documentTypes).map(([key, type], index) => (
            <fieldset key={key} className="document-type-names">
              <legend>
                ประเภทที่ {index + 1} · {type.reviewed ? 'ส่งไป-กลับ มีการตรวจ' : 'ส่งอย่างเดียว'}
              </legend>
              <div className="form-grid">
                <label>
                  ชื่อสั้น (แท็บเมนู)
                  <input
                    value={names[key].label}
                    onChange={(event) => changeName(key, 'label', event.target.value)}
                    maxLength={MAX_LABEL_LENGTH}
                    required
                  />
                </label>
                <label>
                  ชื่อเต็ม (หัวหน้า/อีเมล)
                  <input
                    value={names[key].title}
                    onChange={(event) => changeName(key, 'title', event.target.value)}
                    maxLength={MAX_TITLE_LENGTH}
                    required
                  />
                </label>
              </div>
            </fieldset>
          ))}

          <p className="user-note">
            เปลี่ยนแค่ชื่อที่แสดง วิธีส่งยังเหมือนเดิม และเอกสารที่ส่งไปแล้วจะขึ้นชื่อใหม่ทันที
          </p>

          <div className="form-actions">
            <button className="button-primary" type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={onClose}
              disabled={saveMutation.isPending}
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
