// จัดการยืม-คืนครุภัณฑ์ (เฉพาะ Admin) — TanStack Query ดูแล data fetching/cache ทั้งหมด
// ใช้ query key ['equipment'] และ ['admin-users'] ร่วมกับ EquipmentManager/UserTable เพื่อแชร์ cache เดียวกัน
// คำขอจาก user (status pending) ต้องกด "อนุมัติ"/"ปฏิเสธ" ก่อนถึงจะกลายเป็นการยืมจริง ส่วน Admin สร้างใบยืมเองถือว่าอนุมัติทันที
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getUsers } from '../../../api/admin-users.js';
import {
  approveBorrow,
  createBorrow,
  getBorrows,
  rejectBorrow,
  returnBorrowDetail,
} from '../../../api/borrow.js';
import { getEquipment } from '../../../api/equipment.js';

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

  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [userId, setUserId] = useState('');
  const [returnDate, setReturnDate] = useState(tomorrowDateInput);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [pendingOnly, setPendingOnly] = useState(false);

  const borrowsQuery = useQuery({ queryKey: ['borrows'], queryFn: getBorrows });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: getUsers });
  // ขอเฉพาะชิ้นที่ว่างจาก backend ตรงๆ (limit สูงพอสำหรับของว่างจริง) แยก cache จากตาราง Equipment หลักที่แบ่งหน้า
  const equipmentQuery = useQuery({
    queryKey: ['equipment', 'available'],
    queryFn: () => getEquipment({ status: 'available', limit: 500 }),
  });

  const borrows = borrowsQuery.data?.borrows ?? [];
  const users = usersQuery.data?.users ?? [];
  const availableEquipment = equipmentQuery.data?.equipment ?? [];

  const pendingCount = borrows.filter(
    (borrow) => borrow.status === 'pending',
  ).length;

  // แตก borrow แต่ละใบเป็นแถวต่อรายการ (1 รายการ = 1 ชิ้น) ให้แสดงในตารางเดียวได้ตรงไปตรงมา
  const rows = borrows
    .filter((borrow) => !pendingOnly || borrow.status === 'pending')
    .flatMap((borrow) => borrow.details.map((detail) => ({ borrow, detail })));

  function clearMessages() {
    setError('');
    setNotice('');
  }

  function openForm() {
    clearMessages();
    setUserId('');
    setReturnDate(tomorrowDateInput());
    setSelectedItemIds([]);
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
      setNotice('บันทึกการยืมสำเร็จ');
      closeForm();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const approveMutation = useMutation({
    mutationFn: approveBorrow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setNotice('อนุมัติคำขอยืมสำเร็จ');
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectBorrow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
      setNotice('ปฏิเสธคำขอยืมแล้ว');
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const returnMutation = useMutation({
    mutationFn: returnBorrowDetail,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setNotice(data.message);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  function submitForm(event) {
    event.preventDefault();
    clearMessages();
    createMutation.mutate({
      userId: Number(userId),
      returnDate,
      itemIds: selectedItemIds,
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
  const displayError = borrowsQuery.error?.message || error;

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
              onChange={(event) => setPendingOnly(event.target.checked)}
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
      {notice && <p className="success-message">{notice}</p>}

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
              <select
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                required
              >
                <option value="">เลือกผู้ยืม</option>
                {users.map((item) => (
                  <option key={item.user_id} value={item.user_id}>
                    {item.name} ({item.email})
                  </option>
                ))}
              </select>
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
                <div className="checkbox-list">
                  {availableEquipment.map((item) => (
                    <label key={item.item_id} className="checkbox-list-item">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.item_id)}
                        onChange={() => toggleItem(item.item_id)}
                      />
                      <span className="equipment-code">
                        {item.equipment_code}
                      </span>
                      <span>{item.equipment_name}</span>
                    </label>
                  ))}
                </div>
              )}
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
          <table className="equipment-table borrow-table">
            <thead>
              <tr>
                <th>ผู้ยืม</th>
                <th>ครุภัณฑ์</th>
                <th>วันที่ยืม</th>
                <th>กำหนดคืน</th>
                <th>สถานะ</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ borrow, detail }) => (
                <tr key={detail.borrow_detail_id}>
                  <td>
                    {borrow.user_name}
                    <br />
                    {borrow.user_email}
                  </td>
                  <td>
                    <span className="equipment-code">
                      {detail.equipment_code}
                    </span>
                    <br />
                    {detail.equipment_name}
                  </td>
                  <td>{formatDateTime(borrow.borrow_date)}</td>
                  <td>{formatDateTime(detail.return_date)}</td>
                  <td>
                    <span className={`status-badge status-${detail.status}`}>
                      {statusLabels[detail.status] ?? detail.status}
                    </span>
                  </td>
                  <td>
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
    </section>
  );
}
