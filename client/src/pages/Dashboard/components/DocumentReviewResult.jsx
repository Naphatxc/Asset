// ผลการตรวจ IDP หนึ่งรายการ: ตรวจเมื่อไร โดยใคร หมายเหตุ และไฟล์ที่ Admin แนบกลับ (ถ้ามี)
// ใช้ทั้งในตารางประวัติของผู้ส่ง (DocumentSubmissions.jsx) และ popup ของ Admin (DocumentReviewDialog.jsx)
import { getDocumentDownloadUrl } from '../../../api/documents.js';
import { formatDateTime } from '../../../utils/documents.js';

export default function DocumentReviewResult({ submission }) {
  // ยังไม่ได้ตรวจ ยังไม่มีอะไรให้แสดง
  if (submission.status === 'pending') return '-';

  return (
    <div className="document-review">
      <p className="document-review-meta">
        ตรวจเมื่อ {formatDateTime(submission.reviewed_at)}
        {submission.reviewer_name && ` โดย ${submission.reviewer_name}`}
      </p>
      {submission.review_note && (
        <p className="document-review-note">{submission.review_note}</p>
      )}
      {submission.review_file_url && (
        <a
          className="document-file-link"
          href={getDocumentDownloadUrl(submission.review_file_url)}
          target="_blank"
          rel="noreferrer"
        >
          {submission.review_file_name}
        </a>
      )}
    </div>
  );
}
