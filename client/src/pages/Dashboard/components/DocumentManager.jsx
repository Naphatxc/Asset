// หน้าเอกสารของ Admin: เอกสารที่ผู้ใช้ทุกคนส่งเข้ามา (IDP / OBE 3 / OBE 5) พร้อมวันเวลาที่ส่ง
// - ทุกประเภท: กดชื่อไฟล์เพื่อดาวน์โหลดไฟล์ที่ผู้ใช้ส่งมา
// - IDP: กด "ตรวจ" เปิด popup บันทึกผล (ผ่าน / ส่งกลับให้แก้ไข) ดู DocumentReviewDialog.jsx ส่วน OBE ไม่มีขั้นตอนตรวจ
// ดึงมาทั้งหมดแล้วกรอง/เรียง/แบ่งหน้าฝั่ง client (เหมือนแท็บแจ้งซ่อม) ป้าย "IDP รอตรวจ N" จึงนับจากทั้งหมดเสมอ
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getAllDocuments, getDocumentDownloadUrl } from '../../../api/documents.js';
import {
  SortSelect,
  SortableTh,
  matchesSearch,
  sortRows,
} from '../../../components/ListFilters.jsx';
import PaginationBar, { paginateRows } from '../../../components/PaginationBar.jsx';
import { DOCUMENT_TYPES, STATUS_LABELS, formatDateTime } from '../../../utils/documents.js';
import DocumentReviewDialog from './DocumentReviewDialog.jsx';

// คอลัมน์ที่คลิกเรียงได้
const sortColumns = {
  sender: { label: 'ผู้ส่ง', type: 'text', get: (submission) => submission.user_name },
  academic_year: {
    label: 'ปีการศึกษา',
    type: 'number',
    get: (submission) => submission.academic_year,
    firstDir: 'desc',
    dirLabels: { asc: 'เก่า→ใหม่', desc: 'ใหม่→เก่า' },
  },
  submitted_at: {
    label: 'วันเวลาที่ส่ง',
    type: 'date',
    get: (submission) => submission.submitted_at,
  },
};

export default function DocumentManager() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sort, setSort] = useState({ key: 'submitted_at', dir: 'desc' });
  const [page, setPage] = useState(1);
  // รหัสรายการ IDP ที่เปิด popup อยู่ (null = ไม่ได้เปิด) เก็บแค่รหัสแล้วหาข้อมูลจากรายการล่าสุดทุกครั้ง
  const [openSubmissionId, setOpenSubmissionId] = useState(null);

  const documentsQuery = useQuery({
    queryKey: ['documents', 'all'],
    queryFn: getAllDocuments,
  });
  const allSubmissions = documentsQuery.data?.submissions ?? [];

  const submissions = allSubmissions.filter(
    (submission) =>
      (!typeFilter || submission.doc_type === typeFilter) &&
      (!statusFilter || submission.status === statusFilter) &&
      (!yearFilter || String(submission.academic_year) === yearFilter) &&
      matchesSearch(search, submission.user_name, submission.file_name, submission.note),
  );
  const { rows: pageSubmissions, pagination } = paginateRows(
    sortRows(submissions, sortColumns, sort),
    page,
  );

  // ปีการศึกษาที่มีเอกสารส่งเข้ามาจริง ใหม่สุดก่อน ไว้เป็นตัวเลือกในช่องกรอง
  const years = [...new Set(allSubmissions.map((submission) => submission.academic_year))].sort(
    (a, b) => b - a,
  );
  const pendingCount = allSubmissions.filter(
    (submission) => submission.status === 'pending',
  ).length;
  const openSubmission = allSubmissions.find(
    (submission) => submission.submission_id === openSubmissionId,
  );
  // สถานะมีเฉพาะ IDP ถ้าเลือกดูเฉพาะ OBE 3 / OBE 5 อยู่ ช่องกรองสถานะจึงใช้ไม่ได้
  const statusFilterDisabled = Boolean(typeFilter) && !DOCUMENT_TYPES[typeFilter].reviewed;

  // เปลี่ยนตัวกรองแล้วกลับไปหน้าแรกเสมอ ไม่งั้นอาจค้างอยู่หน้าที่ไม่มีข้อมูลแล้ว
  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function changeType(value) {
    changeFilter(setTypeFilter, value);
    if (value && !DOCUMENT_TYPES[value].reviewed) setStatusFilter('');
  }

  function changeSort(nextSort) {
    setSort(nextSort);
    setPage(1);
  }
  const sortProps = { sortColumns, sort, onSortChange: changeSort };

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Documents</p>
          <h2>
            เอกสารที่ส่งเข้ามา
            {pendingCount > 0 && (
              <span className="status-badge status-doc-pending" style={{ marginLeft: 8 }}>
                IDP รอตรวจ {pendingCount}
              </span>
            )}
          </h2>
        </div>

        <div className="toolbar-actions">
          <span className="item-count">{submissions.length} รายการ</span>
        </div>
      </div>

      {documentsQuery.error && <p className="error-message">{documentsQuery.error.message}</p>}

      <div className="equipment-filters">
        <input
          type="search"
          value={search}
          onChange={(event) => changeFilter(setSearch, event.target.value)}
          placeholder="ค้นหาผู้ส่ง ชื่อไฟล์ หรือหมายเหตุ"
        />
        <select
          value={typeFilter}
          onChange={(event) => changeType(event.target.value)}
          aria-label="ประเภทเอกสาร"
        >
          <option value="">ทุกประเภท</option>
          {Object.entries(DOCUMENT_TYPES).map(([value, documentType]) => (
            <option key={value} value={value}>
              {documentType.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => changeFilter(setStatusFilter, event.target.value)}
          disabled={statusFilterDisabled}
          aria-label="สถานะของ IDP"
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(event) => changeFilter(setYearFilter, event.target.value)}
          aria-label="ปีการศึกษา"
        >
          <option value="">ทุกปีการศึกษา</option>
          {years.map((year) => (
            <option key={year} value={year}>
              ปีการศึกษา {year}
            </option>
          ))}
        </select>
        <SortSelect {...sortProps} />
      </div>

      {documentsQuery.isLoading ? (
        <p className="loading-message">กำลังโหลดรายการเอกสาร...</p>
      ) : documentsQuery.isError ? null : submissions.length === 0 ? (
        <div className="empty-state">
          <p>
            {allSubmissions.length === 0
              ? 'ยังไม่มีเอกสารส่งเข้ามา'
              : 'ไม่พบเอกสารที่ตรงกับตัวกรอง'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="equipment-table responsive-table">
            <thead>
              <tr>
                <SortableTh sortKey="sender" {...sortProps}>
                  ผู้ส่ง
                </SortableTh>
                <th>ประเภท</th>
                <SortableTh sortKey="academic_year" {...sortProps}>
                  ปีการศึกษา
                </SortableTh>
                <SortableTh sortKey="submitted_at" {...sortProps}>
                  วันเวลาที่ส่ง
                </SortableTh>
                <th>ไฟล์</th>
                <th>หมายเหตุ</th>
                <th>สถานะ</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {pageSubmissions.map((submission) => {
                const documentType = DOCUMENT_TYPES[submission.doc_type];

                return (
                  <tr key={submission.submission_id}>
                    <td data-label="ผู้ส่ง">{submission.user_name}</td>
                    <td data-label="ประเภท">{documentType?.label ?? submission.doc_type}</td>
                    <td data-label="ปีการศึกษา">{submission.academic_year}</td>
                    <td data-label="วันเวลาที่ส่ง">{formatDateTime(submission.submitted_at)}</td>
                    <td data-label="ไฟล์">
                      <a
                        className="document-file-link"
                        href={getDocumentDownloadUrl(submission.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        title="ดาวน์โหลดไฟล์"
                      >
                        {submission.file_name}
                      </a>
                    </td>
                    <td data-label="หมายเหตุ">{submission.note || '-'}</td>
                    <td data-label="สถานะ">
                      {submission.status ? (
                        <span className={`status-badge status-doc-${submission.status}`}>
                          {STATUS_LABELS[submission.status] ?? submission.status}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    {/* ปุ่มมีเฉพาะ IDP: ยังรอตรวจ = เปิด popup เพื่อตรวจ ตรวจแล้ว = เปิดดูผลการตรวจ */}
                    {documentType?.reviewed ? (
                      <td className="stack-actions">
                        <div className="row-actions">
                          <button
                            className={submission.status === 'pending' ? 'button-restore' : undefined}
                            type="button"
                            onClick={() => setOpenSubmissionId(submission.submission_id)}
                          >
                            {submission.status === 'pending' ? 'ตรวจ' : 'ดูผลตรวจ'}
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td data-label="การกระทำ">-</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!documentsQuery.isLoading && (
        <PaginationBar pagination={pagination} onPageChange={setPage} />
      )}

      {openSubmission && (
        <DocumentReviewDialog
          submission={openSubmission}
          onClose={() => setOpenSubmissionId(null)}
        />
      )}
    </section>
  );
}
