// Popup ของ Admin สำหรับ IDP หนึ่งรายการ
// - ยังรอตรวจ: เลือกผล (ผ่าน / ส่งกลับให้แก้ไข) ใส่หมายเหตุถึงผู้ส่ง แนบไฟล์กลับได้ แล้วบันทึก ระบบส่งอีเมลแจ้งผลให้ผู้ส่งเอง
// - ตรวจแล้ว: ดูผลการตรวจอย่างเดียว (ตรวจซ้ำไม่ได้ ถ้าผู้ส่งแก้แล้วส่งใหม่จะเป็นรายการใหม่ที่รอตรวจ)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getDocumentDownloadUrl, reviewDocument } from '../../../api/documents.js';
import CharCount from '../../../components/CharCount.jsx';
import FileDropInput from '../../../components/FileDropInput.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import {
  DOCUMENT_ACCEPT,
  MAX_NOTE_LENGTH,
  STATUS_LABELS,
  fileProblem,
  formatDateTime,
} from '../../../utils/documents.js';
import DocumentReviewResult from './DocumentReviewResult.jsx';

export default function DocumentReviewDialog({ submission, onClose }) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  // '' = ยังไม่ได้เลือกผล บังคับให้เลือกเองทุกครั้ง กันกดบันทึกแล้วได้ "ผ่าน" โดยไม่ตั้งใจ
  const [decision, setDecision] = useState('');
  const [note, setNote] = useState('');
  // FileDropInput เก็บไฟล์เป็น array เสมอ ที่นี่แนบกลับได้ไฟล์เดียว จึงมีได้ 0 หรือ 1 ไฟล์
  const [files, setFiles] = useState([]);
  const pending = submission.status === 'pending';

  const reviewMutation = useMutation({
    mutationFn: () =>
      reviewDocument(submission.submission_id, { decision, note, file: files[0] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess('บันทึกผลการตรวจแล้ว');
      onClose();
    },
    onError: (error) => showError(error.message),
  });

  function submitReview(event) {
    event.preventDefault();

    // ส่งกลับให้แก้ต้องบอกผู้ส่งว่าให้แก้อะไร จะเป็นหมายเหตุหรือไฟล์ที่แนบกลับก็ได้ (server เช็คซ้ำอีกชั้น)
    if (decision === 'returned' && !note.trim() && files.length === 0) {
      showError('ส่งกลับให้แก้ไขต้องระบุหมายเหตุ หรือแนบไฟล์กลับ');
      return;
    }

    const problem = files[0] ? fileProblem(files[0]) : null;
    if (problem) {
      showError(problem);
      return;
    }

    reviewMutation.mutate();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="repair-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-review-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">IDP</p>
            <h2 id="document-review-title">{pending ? 'ตรวจ IDP' : 'ผลการตรวจ IDP'}</h2>
          </div>
          <button className="button-secondary" type="button" onClick={onClose}>
            ปิด
          </button>
        </div>

        <dl className="repair-detail-grid">
          <dt>ผู้ส่ง</dt>
          <dd>{submission.user_name}</dd>

          <dt>ปีการศึกษา</dt>
          <dd>{submission.academic_year}</dd>

          <dt>วันเวลาที่ส่ง</dt>
          <dd>{formatDateTime(submission.submitted_at)}</dd>

          <dt>ไฟล์ที่ส่ง</dt>
          <dd>
            <a
              className="document-file-link"
              href={getDocumentDownloadUrl(submission.file_url)}
              target="_blank"
              rel="noreferrer"
            >
              {submission.file_name}
            </a>
          </dd>

          {submission.note && (
            <>
              <dt>หมายเหตุจากผู้ส่ง</dt>
              <dd>{submission.note}</dd>
            </>
          )}

          <dt>สถานะ</dt>
          <dd>
            <span className={`status-badge status-doc-${submission.status}`}>
              {STATUS_LABELS[submission.status] ?? submission.status}
            </span>
          </dd>

          {!pending && (
            <>
              <dt>ผลการตรวจ</dt>
              <dd>
                <DocumentReviewResult submission={submission} />
              </dd>
            </>
          )}
        </dl>

        {pending && (
          <form className="equipment-form" onSubmit={submitReview}>
            <div className="form-heading">
              <div>
                <p className="section-kicker">Review</p>
                <h3>บันทึกผลการตรวจ</h3>
              </div>
            </div>

            <div className="form-grid">
              <label className="field-wide">
                ผลการตรวจ
                <select
                  value={decision}
                  onChange={(event) => setDecision(event.target.value)}
                  required
                >
                  <option value="">-- เลือกผลการตรวจ --</option>
                  <option value="approved">ผ่าน</option>
                  <option value="returned">ส่งกลับให้แก้ไข</option>
                </select>
              </label>

              <label className="field-wide">
                หมายเหตุถึงผู้ส่ง {decision === 'returned' ? '(สิ่งที่ต้องแก้ไข)' : '(ไม่บังคับ)'}
                <textarea
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={MAX_NOTE_LENGTH}
                />
                <CharCount length={note.length} max={MAX_NOTE_LENGTH} />
              </label>

              <label className="field-wide">
                แนบไฟล์กลับ (ไม่บังคับ PDF หรือ Word ไฟล์เดียว ไม่เกิน 10 MB)
                <FileDropInput
                  files={files}
                  onChange={setFiles}
                  multiple={false}
                  accept={DOCUMENT_ACCEPT}
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="button-primary" type="submit" disabled={reviewMutation.isPending}>
                {reviewMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกผลการตรวจ'}
              </button>
              <button className="button-secondary" type="button" onClick={onClose}>
                ยกเลิก
              </button>
              <p className="field-hint">บันทึกแล้วระบบจะส่งอีเมลแจ้งผลการตรวจให้ผู้ส่ง</p>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
