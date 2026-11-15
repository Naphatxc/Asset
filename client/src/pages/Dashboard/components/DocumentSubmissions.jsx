// หน้าส่งเอกสารของผู้ใช้ ใช้ร่วมกันทั้งสามแท็บ: IDP, OBE 3, OBE 5 (ต่างกันที่ prop type)
// - ฟอร์มด้านบน: ระบุปีการศึกษา แนบไฟล์ (PDF/Word ไฟล์เดียว) ใส่หมายเหตุ แล้วกดส่ง
// - ตารางด้านล่าง: ประวัติการส่งของตัวเองทุกครั้งพร้อมวันเวลาที่ส่ง (ส่งซ้ำได้ ไม่ทับของเดิม)
// - IDP เท่านั้นที่มีสถานะ (รอตรวจ/ผ่าน/ส่งกลับให้แก้ไข) และผลการตรวจจาก Admin ถ้าถูกส่งกลับ ให้แก้แล้วส่งใหม่จากฟอร์มเดิม
//   OBE 3 / OBE 5 ส่งอย่างเดียว ไม่มีขั้นตอนตรวจ
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getDocumentDownloadUrl,
  getMyDocuments,
  submitDocument,
} from '../../../api/documents.js';
import CharCount from '../../../components/CharCount.jsx';
import FileDropInput from '../../../components/FileDropInput.jsx';
import PaginationBar, { paginateRows } from '../../../components/PaginationBar.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { useDocumentTypes } from '../../../hooks/useDocumentTypes.js';
import {
  DOCUMENT_ACCEPT,
  MAX_NOTE_LENGTH,
  MIN_ACADEMIC_YEAR,
  STATUS_LABELS,
  currentAcademicYear,
  fileProblem,
  formatDateTime,
  maxAcademicYear,
} from '../../../utils/documents.js';
import DocumentReviewResult from './DocumentReviewResult.jsx';

export default function DocumentSubmissions({ type }) {
  // ชื่อที่ Admin ตั้งไว้ (ชื่อสั้นบนปุ่ม/ข้อความ ชื่อเต็มบนหัวหน้า)
  const { label, title, reviewed } = useDocumentTypes()[type];
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();

  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  // FileDropInput เก็บไฟล์เป็น array เสมอ หน้านี้รับไฟล์เดียว (multiple={false}) จึงมีได้ 0 หรือ 1 ไฟล์
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState('');
  const [page, setPage] = useState(1);

  const documentsQuery = useQuery({
    queryKey: ['documents', 'mine', type],
    queryFn: () => getMyDocuments(type),
  });
  const submissions = documentsQuery.data?.submissions ?? [];
  const { rows: pageSubmissions, pagination } = paginateRows(submissions, page);
  // server เรียงใหม่สุดก่อน ตัวแรกจึงเป็นการส่งครั้งล่าสุด
  const latest = submissions[0];

  const submitMutation = useMutation({
    mutationFn: submitDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess(`ส่ง ${label} สำเร็จ`);
      setFiles([]);
      setNote('');
      setPage(1);
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
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Documents</p>
          <h2>{title}</h2>
        </div>

        <div className="toolbar-actions">
          <span className="item-count">ส่งแล้ว {submissions.length} ครั้ง</span>
        </div>
      </div>

      {reviewed && latest?.status === 'returned' && (
        <p className="document-notice">
          {label} ที่ส่งล่าสุดถูกส่งกลับให้แก้ไข ดูหมายเหตุจากผู้ตรวจในตารางด้านล่าง
          แก้ไขแล้วแนบไฟล์ใหม่ส่งได้จากฟอร์มนี้
        </p>
      )}

      <form className="equipment-form" onSubmit={submitForm}>
        <div className="form-heading">
          <div>
            <p className="section-kicker">New submission</p>
            <h3>ส่ง {label}</h3>
          </div>
        </div>

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
        </div>
      </form>

      <h3 className="document-history-heading">ประวัติการส่ง</h3>

      {documentsQuery.isLoading ? (
        <p className="loading-message">กำลังโหลดประวัติการส่ง...</p>
      ) : documentsQuery.isError ? (
        <p className="error-message">{documentsQuery.error.message}</p>
      ) : submissions.length === 0 ? (
        <div className="empty-state">
          <p>ยังไม่เคยส่ง {label}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="equipment-table responsive-table">
            <thead>
              <tr>
                <th>วันเวลาที่ส่ง</th>
                <th>ปีการศึกษา</th>
                <th>ไฟล์</th>
                <th>หมายเหตุ</th>
                {reviewed && <th>สถานะ</th>}
                {reviewed && <th>ผลการตรวจ</th>}
              </tr>
            </thead>
            <tbody>
              {pageSubmissions.map((submission) => (
                <tr key={submission.submission_id}>
                  <td data-label="วันเวลาที่ส่ง">{formatDateTime(submission.submitted_at)}</td>
                  <td data-label="ปีการศึกษา">{submission.academic_year}</td>
                  <td data-label="ไฟล์">
                    <a
                      className="document-file-link"
                      href={getDocumentDownloadUrl(submission.file_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {submission.file_name}
                    </a>
                  </td>
                  <td data-label="หมายเหตุ">{submission.note || '-'}</td>
                  {reviewed && (
                    <td data-label="สถานะ">
                      <span className={`status-badge status-doc-${submission.status}`}>
                        {STATUS_LABELS[submission.status] ?? submission.status}
                      </span>
                    </td>
                  )}
                  {reviewed && (
                    <td data-label="ผลการตรวจ">
                      <DocumentReviewResult submission={submission} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!documentsQuery.isLoading && (
        <PaginationBar pagination={pagination} onPageChange={setPage} />
      )}
    </section>
  );
}
