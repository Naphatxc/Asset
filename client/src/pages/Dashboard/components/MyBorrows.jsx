// รายการยืมของตัวเอง (User ธรรมดา) — ส่งคำขอยืม/ดู/คืนเองได้ แต่คำขอต้องรอ Admin อนุมัติก่อนถึงจะยืมได้จริง
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getMyBorrows,
  requestBorrow,
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

export default function MyBorrows() {
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [returnDate, setReturnDate] = useState(tomorrowDateInput);
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  const borrowsQuery = useQuery({
    queryKey: ['borrows', 'mine'],
    queryFn: getMyBorrows,
  });
  // ขอเฉพาะชิ้นที่ว่างจาก backend ตรงๆ แยก cache จากตาราง Equipment หลักที่แบ่งหน้า
  const equipmentQuery = useQuery({
    queryKey: ['equipment', 'available'],
    queryFn: () => getEquipment({ status: 'available', limit: 500 }),
    enabled: formOpen,
  });

  const borrows = borrowsQuery.data?.borrows ?? [];
  const availableEquipment = equipmentQuery.data?.equipment ?? [];
  const rows = borrows.flatMap((borrow) =>
    borrow.details.map((detail) => ({ borrow, detail })),
  );

  function clearMessages() {
    setError('');
    setNotice('');
  }

  function openForm() {
    clearMessages();
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

  const requestMutation = useMutation({
    mutationFn: requestBorrow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrows', 'mine'] });
      setNotice('ส่งคำขอยืมสำเร็จ รอการอนุมัติจากผู้ดูแลระบบ');
      closeForm();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const returnMutation = useMutation({
    mutationFn: returnBorrowDetail,
    // กดคืนเองแค่ส่งคำขอ (return_requested_at) ยังไม่เปลี่ยนสถานะครุภัณฑ์จริง จึงไม่ invalidate ['equipment']
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrows', 'mine'] });
      setNotice(data.message);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  function submitForm(event) {
    event.preventDefault();
    clearMessages();
    requestMutation.mutate({ returnDate, itemIds: selectedItemIds });
  }

  const busyBorrowDetailId = returnMutation.isPending
    ? returnMutation.variables
    : null;

  const loading = borrowsQuery.isLoading;
  const displayError = borrowsQuery.error?.message || error;

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
      {notice && <p className="success-message">{notice}</p>}

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

      {loading ? (
        <p className="loading-message">กำลังโหลดรายการยืม...</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>คุณยังไม่มีรายการยืม</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="equipment-table borrow-table">
            <thead>
              <tr>
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
    </section>
  );
}
