// จัดการยืม-คืนครุภัณฑ์ (เฉพาะ Admin) — TanStack Query ดูแล data fetching/cache ทั้งหมด
// ใช้ query key ['equipment'] และ ['admin-users'] ร่วมกับ EquipmentManager/UserTable เพื่อแชร์ cache เดียวกัน
// คำขอจาก user (status pending) ต้องกด "อนุมัติ"/"ปฏิเสธ" ก่อนถึงจะกลายเป็นการยืมจริง ส่วน Admin สร้างใบยืมเองถือว่าอนุมัติทันที
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { getUsers } from '../../../api/admin-users.js';
import {
  approveBorrow,
  createBorrow,
  getBorrows,
  rejectBorrow,
  returnBorrowDetail,
} from '../../../api/borrow.js';
import { getAvailableEquipment } from '../../../api/equipment.js';
import CharCount from '../../../components/CharCount.jsx';
import EquipmentPicker from '../../../components/EquipmentPicker.jsx';
import PaginationBar, { paginateRows } from '../../../components/PaginationBar.jsx';
import SearchableSelect from '../../../components/SearchableSelect.jsx';
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

export default function BorrowManager() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [returnDate, setReturnDate] = useState(tomorrowDateInput);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [remark, setRemark] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [page, setPage] = useState(1);

  const borrowsQuery = useQuery({ queryKey: ['borrows'], queryFn: getBorrows });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: getUsers });
  // ขอเฉพาะชิ้นที่ว่างทั้งหมดจาก backend (ไม่แบ่งหน้า) แยก cache จากตาราง Equipment หลักที่แบ่งหน้า
  const equipmentQuery = useQuery({
    queryKey: ['equipment', 'available'],
    queryFn: getAvailableEquipment,
  });

  const borrows = borrowsQuery.data?.borrows ?? [];
  const users = usersQuery.data?.users ?? [];
  const availableEquipment = equipmentQuery.data?.equipment ?? [];

  // แปลงเป็น { value, label } ให้ SearchableSelect ใช้ตรงกัน ค้นหาได้ทั้งชื่อและอีเมล
  const userOptions = useMemo(
    () =>
      users.map((item) => ({
        value: String(item.user_id),
        label: `${item.name} (${item.email})`,
        searchText: `${item.name} ${item.email}`,
      })),
    [users],
  );

  const pendingCount = borrows.filter(
    (borrow) => borrow.status === 'pending',
  ).length;

  // แตก borrow แต่ละใบเป็นแถวต่อรายการ (1 รายการ = 1 ชิ้น) ให้แสดงในตารางเดียวได้ตรงไปตรงมา
  const rows = borrows
    .filter((borrow) => !pendingOnly || borrow.status === 'pending')
    .flatMap((borrow) => borrow.details.map((detail) => ({ borrow, detail })));
  // server ส่งมาทั้งหมด แบ่งหน้าฝั่ง client ให้หน้าตาเหมือนแท็บครุภัณฑ์/วัสดุ
  const { rows: pageRows, pagination } = paginateRows(rows, page);

  function openForm() {
    setUserId('');
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

  const createMutation = useMutation({
    mutationFn: createBorrow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      showSuccess('บันทึกการยืมสำเร็จ');
      closeForm();
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const approveMutation = useMutation({
    mutationFn: approveBorrow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      showSuccess('อนุมัติคำขอยืมสำเร็จ');
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectBorrow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
      showSuccess('ปฏิเสธคำขอยืมแล้ว');
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const returnMutation = useMutation({
    mutationFn: returnBorrowDetail,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      showSuccess(data.message);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  function submitForm(event) {
    event.preventDefault();
    createMutation.mutate({
      userId: Number(userId),
      returnDate,
      itemIds: selectedItemIds,
      remark,
    });
  }

  const busyBorrowId =
    (approveMutation.isPending && approveMutation.variables) ||
    (rejectMutation.isPending && rejectMutation.variables) ||
    null;
  const busyBorrowDetailId = returnMutation.isPending
    ? returnMutation.variables
    : null;

  const loading = borrowsQuery.isLoading;
  const displayError = borrowsQuery.error?.message;

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Borrow</p>
          <h2>
            ใบยืม-คืนครุภัณฑ์
            {pendingCount > 0 && (
              <span className="status-badge status-pending" style={{ marginLeft: 8 }}>
                รออนุมัติ {pendingCount}
              </span>
            )}
          </h2>
        </div>

        <div className="toolbar-actions">
          <label style={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(event) => {
                setPendingOnly(event.target.checked);
                setPage(1);
              }}
            />
            แสดงเฉพาะรออนุมัติ
          </label>
          <span className="item-count">{rows.length} รายการ</span>
          {!formOpen && (
            <button className="button-primary" type="button" onClick={openForm}>
              + สร้างใบยืม
            </button>
          )}
        </div>
      </div>

      {displayError && <p className="error-message">{displayError}</p>}

      {formOpen && (
        <form className="equipment-form" onSubmit={submitForm}>
          <div className="form-heading">
            <div>
              <p className="section-kicker">New borrow</p>
              <h3>สร้างใบยืม</h3>
            </div>
            <button className="button-secondary" type="button" onClick={closeForm}>
              ปิด
            </button>
          </div>

          <div className="form-grid">
            <label>
              ผู้ยืม
              <SearchableSelect
                name="userId"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                required
                emptyLabel="เลือกผู้ยืม"
                placeholder="พิมพ์ชื่อหรืออีเมลเพื่อค้นหา..."
                options={userOptions}
              />
            </label>

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
              {availableEquipment.length === 0 ? (
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
                createMutation.isPending || selectedItemIds.length === 0
              }
            >
              {createMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกการยืม'}
            </button>
            <button className="button-secondary" type="button" onClick={closeForm}>
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="loading-message">กำลังโหลดรายการยืม...</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>{pendingOnly ? 'ไม่มีคำขอที่รออนุมัติ' : 'ยังไม่มีรายการยืม'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="equipment-table responsive-table">
            <thead>
              <tr>
                <th>ผู้ยืม</th>
                <th>ครุภัณฑ์</th>
                <th>วันที่ยืม</th>
                <th>กำหนดคืน</th>
                <th>หมายเหตุ</th>
                <th>สถานะ</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ borrow, detail }) => (
                <tr key={detail.borrow_detail_id}>
                  <td data-label="ผู้ยืม">
                    {borrow.user_name}
                    <br />
                    {borrow.user_email}
                  </td>
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
                  </td>
                  <td className="stack-actions">
                    {detail.status === 'pending' ? (
                      <div className="row-actions">
                        <button
                          className="button-restore"
                          type="button"
                          disabled={busyBorrowId === borrow.borrow_id}
                          onClick={() =>
                            approveMutation.mutate(borrow.borrow_id)
                          }
                        >
                          อนุมัติ
                        </button>
                        <button
                          className="button-danger"
                          type="button"
                          disabled={busyBorrowId === borrow.borrow_id}
                          onClick={() =>
                            rejectMutation.mutate(borrow.borrow_id)
                          }
                        >
                          ปฏิเสธ
                        </button>
                      </div>
                    ) : detail.status === 'borrowed' ||
                      detail.status === 'overdue' ||
                      detail.status === 'pending_return' ? (
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
                            : detail.status === 'pending_return'
                              ? 'ยืนยันการคืน'
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
