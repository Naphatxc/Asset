// ฟอร์มส่งเอกสาร (ปีการศึกษา + ไฟล์ + หมายเหตุ) ถือ state และ mutation ของตัวเองเลย
// ใช้ 2 ที่: ฟอร์มหลักด้านบนหน้าส่งเอกสาร (DocumentSubmissions.jsx) และ popup "แก้ไขแล้วส่งใหม่" (DocumentResubmitDialog.jsx)
// onSuccess ถูกเรียกหลังส่งสำเร็จ ให้ที่เรียกใช้ตัดสินใจเองว่าจะทำอะไรต่อ (กลับหน้าแรกของตาราง / ปิด popup)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { submitDocument } from '../../../api/documents.js';
import CharCount from '../../../components/CharCount.jsx';
import FileDropInput from '../../../components/FileDropInput.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { useDocumentTypes } from '../../../hooks/useDocumentTypes.js';
import {
  DOCUMENT_ACCEPT,
  MAX_NOTE_LENGTH,
  MIN_ACADEMIC_YEAR,
  currentAcademicYear,
  fileProblem,
  maxAcademicYear,
} from '../../../utils/documents.js';

// heading: ส่วนหัวของฟอร์ม / extraActions: ปุ่มเพิ่มข้างปุ่มส่ง (เช่น ยกเลิกใน popup) ใส่หรือไม่ก็ได้
// initialYear: ปีตั้งต้น ไม่ใส่ = ปีการศึกษาปัจจุบัน
export default function DocumentSubmitForm({ type, heading, extraActions, initialYear, onSuccess }) {
  const { label, reviewed } = useDocumentTypes()[type];
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();

  const [academicYear, setAcademicYear] = useState(initialYear ?? currentAcademicYear());
  // FileDropInput เก็บไฟล์เป็น array เสมอ ฟอร์มนี้รับไฟล์เดียว (multiple={false}) จึงมีได้ 0 หรือ 1 ไฟล์
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState('');

  const submitMutation = useMutation({
    mutationFn: submitDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess(`ส่ง ${label} สำเร็จ`);
      setFiles([]);
      setNote('');
      onSuccess?.();
    },
    onError: (error) => showError(error.message),
  });

  function submitForm(event) {
    event.preventDefault();

    // เช็คไฟล์ก่อนส่ง (ต้องมีไฟล์ / ชนิดไฟล์ / ขนาด) server เช็คซ้ำอีกชั้นอยู่แล้ว
    const problem = fileProblem(files[0]);
    if (problem) {
      showError(problem);
      return;
    }

    submitMutation.mutate({
      type: type,
      academicYear: Number(academicYear),
      note: note,
      file: files[0],
    });
  }

  return (
    <form className="equipment-form" onSubmit={submitForm}>
      {heading}

      <div className="form-grid">
        <label>
          ปีการศึกษา (พ.ศ.)
          <input
            type="number"
            min={MIN_ACADEMIC_YEAR}
            max={maxAcademicYear()}
            value={academicYear}
            onChange={(event) => setAcademicYear(event.target.value)}
            required
          />
        </label>

        <label className="field-wide">
          ไฟล์เอกสาร (PDF หรือ Word ไฟล์เดียว ไม่เกิน 10 MB)
          <FileDropInput
            files={files}
            onChange={setFiles}
            multiple={false}
            accept={DOCUMENT_ACCEPT}
          />
        </label>

        <label className="field-wide">
          หมายเหตุ (ไม่บังคับ)
          <textarea
            rows="2"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            placeholder={reviewed ? '' : 'เช่น รหัสและชื่อรายวิชา'}
          />
          <CharCount length={note.length} max={MAX_NOTE_LENGTH} />
        </label>
      </div>

      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={submitMutation.isPending}>
          {submitMutation.isPending ? 'กำลังส่ง...' : `ส่ง ${label}`}
        </button>
        {extraActions}
      </div>
    </form>
  );
}
