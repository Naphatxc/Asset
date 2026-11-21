// หน้าส่งเอกสารของผู้ใช้ ใช้ร่วมกันทั้งสามแท็บ: IDP, OBE 3, OBE 5 (ต่างกันที่ prop type)
// - ฟอร์มด้านบน: ระบุปีการศึกษา แนบไฟล์ (PDF/Word ไฟล์เดียว) ใส่หมายเหตุ แล้วกดส่ง
// - ตารางด้านล่าง: ประวัติการส่งของตัวเองทุกครั้งพร้อมวันเวลาที่ส่ง (ส่งซ้ำได้ ไม่ทับของเดิม)
// - IDP เท่านั้นที่มีสถานะ (รอตรวจ/ผ่าน/ส่งกลับให้แก้ไข) และผลการตรวจจาก Admin ถ้าถูกส่งกลับ กดปุ่ม "แก้ไขแล้วส่งใหม่"
//   ในแถวนั้นเพื่อเปิด popup ส่งใหม่ (DocumentResubmitDialog.jsx) ส่วน OBE 3 / OBE 5 ส่งอย่างเดียว ไม่มีขั้นตอนตรวจ
// - ฟอร์มส่งอยู่ที่ DocumentSubmitForm.jsx (ใช้ทั้งฟอร์มหลักและ popup)
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getDocumentDownloadUrl, getMyDocuments } from '../../../api/documents.js';
import { matchesSearch } from '../../../components/ListFilters.jsx';
import PaginationBar, { paginateRows } from '../../../components/PaginationBar.jsx';
import StatusChips from '../../../components/StatusChips.jsx';
import { useDocumentTypes } from '../../../hooks/useDocumentTypes.js';
import { STATUS_LABELS, formatDateTime } from '../../../utils/documents.js';
import DocumentResubmitDialog from './DocumentResubmitDialog.jsx';
import DocumentReviewResult from './DocumentReviewResult.jsx';
import DocumentSubmitForm from './DocumentSubmitForm.jsx';

export default function DocumentSubmissions({ type }) {
  // ชื่อที่ Admin ตั้งไว้ (ชื่อสั้นบนปุ่ม/ข้อความ ชื่อเต็มบนหัวหน้า)
  const { label, title, reviewed } = useDocumentTypes()[type];

  const [page, setPage] = useState(1);
  // เปิด popup ส่งใหม่อยู่หรือไม่ (popup ดูผลการตรวจของรายการที่ถูกส่งกลับล่าสุด)
  const [resubmitting, setResubmitting] = useState(false);
  // ตัวกรองประวัติการส่ง (ไม่เกี่ยวกับฟอร์มส่งด้านบน)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const documentsQuery = useQuery({
    queryKey: ['documents', 'mine', type],
    queryFn: () => getMyDocuments(type),
  });
  const submissions = documentsQuery.data?.submissions ?? [];
  const filteredSubmissions = submissions.filter(
    (submission) =>
      (!statusFilter || submission.status === statusFilter) &&
      (!yearFilter || String(submission.academic_year) === yearFilter) &&
      matchesSearch(search, submission.file_name, submission.note),
  );
  const { rows: pageSubmissions, pagination } = paginateRows(filteredSubmissions, page);
  // server เรียงใหม่สุดก่อน ตัวแรกจึงเป็นการส่งครั้งล่าสุด (ดูจากทั้งหมด ไม่ขึ้นกับตัวกรอง)
  const latest = submissions[0];

  // ปีการศึกษาที่เคยส่งจริง ใหม่สุดก่อน ไว้เป็นตัวเลือกในช่องกรอง
  const years = [...new Set(submissions.map((submission) => submission.academic_year))].sort(
    (a, b) => b - a,
  );
  // ปุ่มกรองสถานะมีเฉพาะ IDP ที่มีขั้นตอนตรวจ นับจากประวัติทั้งหมด
  const statusOptions = [
    { value: '', label: 'ทั้งหมด', count: submissions.length },
    ...Object.entries(STATUS_LABELS).map(([value, statusLabel]) => ({
      value,
      label: statusLabel,
      tone: value,
      count: submissions.filter((submission) => submission.status === value).length,
    })),
  ];
  const hasFilters = Boolean(search || statusFilter || yearFilter);

  // เปลี่ยนตัวกรองแล้วกลับไปหน้าแรกเสมอ ไม่งั้นอาจค้างอยู่หน้าที่ไม่มีข้อมูลแล้ว
  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setYearFilter('');
    setPage(1);
  }

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Documents</p>
          <h2>{title}</h2>
        </div>

        <div className="toolbar-actions">
          <span className="item-count">
            {hasFilters
              ? `แสดง ${filteredSubmissions.length} จาก ${submissions.length} ครั้ง`
              : `ส่งแล้ว ${submissions.length} ครั้ง`}
          </span>
        </div>
      </div>

      {reviewed && latest?.status === 'returned' && (
        <p className="document-notice">
          {label} ที่ส่งล่าสุดถูกส่งกลับให้แก้ไข ดูหมายเหตุจากผู้ตรวจในตารางด้านล่าง
          แล้วกด "แก้ไขแล้วส่งใหม่" ในแถวนั้น
        </p>
      )}

      <DocumentSubmitForm
        type={type}
        onSuccess={() => setPage(1)}
        heading={
          <div className="form-heading">
            <div>
              <p className="section-kicker">New submission</p>
              <h3>ส่ง {label}</h3>
            </div>
          </div>
        }
      />

      <h3 className="document-history-heading">ประวัติการส่ง</h3>

      {submissions.length > 0 && (
        <>
          {reviewed && (
            <StatusChips
              ariaLabel="กรองตามสถานะ"
              options={statusOptions}
              value={statusFilter}
              onChange={(value) => changeFilter(setStatusFilter, value)}
            />
          )}

          <div className="equipment-filters">
            <label className="filter-field filter-field-grow">
              <span>ค้นหา</span>
              <input
                type="search"
                value={search}
                onChange={(event) => changeFilter(setSearch, event.target.value)}
                placeholder="ชื่อไฟล์หรือหมายเหตุ"
              />
            </label>
            <label className="filter-field">
              <span>ปีการศึกษา</span>
              <select
                value={yearFilter}
                onChange={(event) => changeFilter(setYearFilter, event.target.value)}
              >
                <option value="">ทุกปีการศึกษา</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    ปีการศึกษา {year}
                  </option>
                ))}
              </select>
            </label>
            {hasFilters && (
              <button className="button-secondary filter-clear" type="button" onClick={clearFilters}>
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </>
      )}

      {documentsQuery.isLoading ? (
        <p className="loading-message">กำลังโหลดประวัติการส่ง...</p>
      ) : documentsQuery.isError ? (
        <p className="error-message">{documentsQuery.error.message}</p>
      ) : submissions.length === 0 ? (
        <div className="empty-state">
          <p>ยังไม่เคยส่ง {label}</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="empty-state">
          <p>ไม่พบประวัติการส่งที่ตรงกับตัวกรอง</p>
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
                      {/* เฉพาะรายการล่าสุดที่ถูกส่งกลับ ถ้าส่งใหม่ไปแล้ว รายการเก่าไม่ต้องมีปุ่มซ้ำ */}
                      {submission === latest && submission.status === 'returned' && (
                        <div className="row-actions document-resubmit">
                          <button
                            className="document-resubmit-button"
                            type="button"
                            onClick={() => setResubmitting(true)}
                          >
                            แก้ไขแล้วส่งใหม่
                          </button>
                        </div>
                      )}
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

      {resubmitting && latest?.status === 'returned' && (
        <DocumentResubmitDialog
          type={type}
          label={label}
          returned={latest}
          onClose={() => setResubmitting(false)}
          // ส่งใหม่แล้วล้างตัวกรอง ไม่งั้นรายการใหม่ (รอตรวจ) อาจถูกกรองซ่อนไว้จนผู้ส่งนึกว่าส่งไม่สำเร็จ
          onSubmitted={clearFilters}
        />
      )}
    </section>
  );
}
