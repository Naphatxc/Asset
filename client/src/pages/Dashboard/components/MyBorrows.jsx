// รายการยืมของตัวเอง (User ธรรมดา) — ส่งคำขอยืม/ดู/คืนเองได้ แต่คำขอต้องรอ Admin อนุมัติก่อนถึงจะยืมได้จริง
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getMyBorrows,
  requestBorrow,
  returnBorrowDetail,
} from '../../../api/borrow.js';
import { getAvailableEquipment } from '../../../api/equipment.js';
import CharCount from '../../../components/CharCount.jsx';
import EquipmentPicker from '../../../components/EquipmentPicker.jsx';
import ListFilters, {
  SortableTh,
  matchesSearch,
  sortRows,
} from '../../../components/ListFilters.jsx';
import PaginationBar, { paginateRows } from '../../../components/PaginationBar.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';

const MAX_REMARK_LENGTH = 2000; // ต้องตรงกับ server (borrow.validator.js)

const statusLabels = {
  pending: 'รออนุมัติ',
  rejected: 'ถูกปฏิเสธ',
  borrowed: 'ยืมอยู่',
  overdue: 'เลยกำหนด',
  pending_return: 'รอยืนยันการคืน',
  returned: 'คืนแล้ว',
};

// คอลัมน์ที่คลิกเรียงได้ แถวคือ { borrow, detail } (1 แถว = 1 ชิ้น) สถานะไม่ต้องเรียงเพราะมีตัวกรองแล้ว
const sortColumns = {
  code: { label: 'รหัสครุภัณฑ์', type: 'text', get: ({ detail }) => detail.equipment_code, dirLabels: { asc: 'A→Z', desc: 'Z→A' } },
  borrow_date: { label: 'วันที่ยืม', type: 'date', get: ({ borrow }) => borrow.borrow_date },
  return_date: { label: 'กำหนดคืน', type: 'date', get: ({ detail }) => detail.return_date, dirLabels: { asc: 'ใกล้→ไกล', desc: 'ไกล→ใกล้' }, firstDir: 'asc' },
};

function formatDateTime(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

// input type="date" ต้องการ YYYY-MM-DD
function tomorrowDateInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function MyBorrows() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [returnDate, setReturnDate] = useState(tomorrowDateInput);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [remark, setRemark] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState({ key: 'borrow_date', dir: 'desc' });

  const borrowsQuery = useQuery({
    queryKey: ['borrows', 'mine'],
    queryFn: getMyBorrows,
  });
  // ขอเฉพาะชิ้นที่ว่างจาก backend ตรงๆ แยก cache จากตาราง Equipment หลักที่แบ่งหน้า
  const equipmentQuery = useQuery({
    queryKey: ['equipment', 'available'],
    queryFn: getAvailableEquipment,
    enabled: formOpen,
  });

  const borrows = borrowsQuery.data?.borrows ?? [];
  const availableEquipment = equipmentQuery.data?.equipment ?? [];
  const allRows = borrows.flatMap((borrow) =>
    borrow.details.map((detail) => ({ borrow, detail })),
  );
  const rows = allRows.filter(
    ({ borrow, detail }) =>
      (!statusFilter || detail.status === statusFilter) &&
      matchesSearch(search, detail.equipment_code, detail.equipment_name, borrow.remark),
  );
  const { rows: pageRows, pagination } = paginateRows(sortRows(rows, sortColumns, sort), page);

  function changeSort(nextSortValue) {
    setSort(nextSortValue);
    setPage(1);
  }
  const sortProps = { sortColumns, sort, onSortChange: changeSort };


  function openForm() {
    setReturnDate(tomorrowDateInput());
    setSelectedItemIds([]);
    setRemark('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  function toggleItem(itemId) {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  }

  const requestMutation = useMutation({
    mutationFn: requestBorrow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrows', 'mine'] });
      showSuccess('ส่งคำขอยืมสำเร็จ รอการอนุมัติจากผู้ดูแลระบบ');
      closeForm();
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const returnMutation = useMutation({
    mutationFn: returnBorrowDetail,
    // กดคืนเองแค่ส่งคำขอ (return_requested_at) ยังไม่เปลี่ยนสถานะครุภัณฑ์จริง จึงไม่ invalidate ['equipment']
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrows', 'mine'] });
      showSuccess(data.message);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  function submitForm(event) {
    event.preventDefault();
    requestMutation.mutate({ returnDate, itemIds: selectedItemIds, remark });
  }

  const busyBorrowDetailId = returnMutation.isPending
    ? returnMutation.variables
    : null;

  const loading = borrowsQuery.isLoading;
  const displayError = borrowsQuery.error?.message;

  return (
    <section className="admin-section">
      <div className="section-heading equipment-toolbar">
        <h2>ครุภัณฑ์ที่ฉันยืม</h2>

        {!formOpen && (
          <button className="button-primary" type="button" onClick={openForm}>
            + ส่งคำขอยืม
          </button>
        )}
      </div>

      {displayError && <p className="error-message">{displayError}</p>}

      {formOpen && (
        <form className="equipment-form" onSubmit={submitForm}>
          <div className="form-heading">
            <div>
              <p className="section-kicker">New request</p>
              <h3>ส่งคำขอยืมครุภัณฑ์</h3>
            </div>
            <button className="button-secondary" type="button" onClick={closeForm}>
              ปิด
            </button>
          </div>

          <div className="form-grid">
            <label>
              วันครบกำหนดคืน
              <input
                type="date"
                value={returnDate}
                min={tomorrowDateInput()}
                onChange={(event) => setReturnDate(event.target.value)}
                required
              />
            </label>

            <label className="field-wide">
              ครุภัณฑ์ที่จะยืม ({selectedItemIds.length} ชิ้น)
              {equipmentQuery.isLoading ? (
                <p className="loading-message">กำลังโหลดรายการครุภัณฑ์...</p>
              ) : availableEquipment.length === 0 ? (
                <p className="loading-message">ไม่มีครุภัณฑ์ที่พร้อมให้ยืมตอนนี้</p>
              ) : (
                <EquipmentPicker
                  items={availableEquipment}
                  selectedIds={selectedItemIds}
                  onToggle={toggleItem}
                />
              )}
            </label>

            <label className="field-wide">
              หมายเหตุ (ไม่บังคับ)
              <textarea
                rows="3"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                maxLength={MAX_REMARK_LENGTH}
                placeholder="เหตุผลหรือหมายเหตุการยืม เช่น ใช้ในงานสัมมนาวันที่..."
              />
              <CharCount length={remark.length} max={MAX_REMARK_LENGTH} />
            </label>
          </div>

          <div className="form-actions">
            <button
              className="button-primary"
              type="submit"
              disabled={
                requestMutation.isPending || selectedItemIds.length === 0
              }
            >
              {requestMutation.isPending ? 'กำลังส่งคำขอ...' : 'ส่งคำขอยืม'}
            </button>
            <button className="button-secondary" type="button" onClick={closeForm}>
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      <ListFilters
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="ค้นหารหัสหรือชื่อครุภัณฑ์"
        status={statusFilter}
        onStatusChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        statusLabels={statusLabels}
        sort={sort}
        onSortChange={changeSort}
        sortColumns={sortColumns}
      />

      {loading ? (
        <p className="loading-message">กำลังโหลดรายการยืม...</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>{allRows.length === 0 ? 'คุณยังไม่มีรายการยืม' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="equipment-table responsive-table">
            <thead>
              <tr>
                <SortableTh sortKey="code" {...sortProps}>ครุภัณฑ์</SortableTh>
                <SortableTh sortKey="borrow_date" {...sortProps}>วันที่ยืม</SortableTh>
                <SortableTh sortKey="return_date" {...sortProps}>กำหนดคืน</SortableTh>
                <th>หมายเหตุ</th>
                <th>สถานะ</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ borrow, detail }) => (
                <tr key={detail.borrow_detail_id}>
                  <td data-label="ครุภัณฑ์">
                    <span className="equipment-code">
                      {detail.equipment_code}
                    </span>
                    <br />
                    {detail.equipment_name}
                  </td>
                  <td data-label="วันที่ยืม">{formatDateTime(borrow.borrow_date)}</td>
                  <td data-label="กำหนดคืน">{formatDateTime(detail.return_date)}</td>
                  <td data-label="หมายเหตุ">{borrow.remark || '-'}</td>
                  <td data-label="สถานะ">
                    <span className={`status-badge status-${detail.status}`}>
                      {statusLabels[detail.status] ?? detail.status}
                    </span>
                    {detail.status === 'returned' && (
                      <small className="borrow-status-note">
                        รับคืนโดย {detail.returned_by_name ?? 'ไม่ทราบ'}
                        <br />
                        {formatDateTime(detail.returned_at)}
                      </small>
                    )}
                    {detail.status === 'pending_return' && (
                      <small className="borrow-status-note">
                        แจ้งคืนเมื่อ {formatDateTime(detail.return_requested_at)}
                      </small>
                    )}
                  </td>
                  <td className="stack-actions">
                    {detail.status === 'borrowed' ||
                    detail.status === 'overdue' ? (
                      <div className="row-actions">
                        <button
                          className="button-restore"
                          type="button"
                          disabled={
                            busyBorrowDetailId === detail.borrow_detail_id
                          }
                          onClick={() =>
                            returnMutation.mutate(detail.borrow_detail_id)
                          }
                        >
                          {busyBorrowDetailId === detail.borrow_detail_id
                            ? 'กำลังบันทึก...'
                            : 'คืน'}
                        </button>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && <PaginationBar pagination={pagination} onPageChange={setPage} />}
    </section>
  );
}
