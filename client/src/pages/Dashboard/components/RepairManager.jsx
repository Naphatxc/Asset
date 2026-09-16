// จัดการแจ้งซ่อมครุภัณฑ์ (เฉพาะ Admin) — แจ้งซ่อม + ดูรายละเอียด/เริ่มซ่อม/บันทึกผลซ่อม/ยกเลิก อยู่ใน RepairDetailDialog
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getEquipment } from '../../../api/equipment.js';
import { getRepairs, reportRepair, startRepair } from '../../../api/repair.js';
import RepairDetailDialog from './RepairDetailDialog.jsx';

const statusLabels = {
  pending_repair: 'รอซ่อม',
  repairing: 'กำลังซ่อม',
  completed: 'ซ่อมเสร็จแล้ว',
  cancelled: 'ยกเลิกแล้ว',
};

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'pending_repair', label: 'รอซ่อม' },
  { value: 'repairing', label: 'กำลังซ่อม' },
  { value: 'completed', label: 'ซ่อมเสร็จแล้ว' },
  { value: 'cancelled', label: 'ยกเลิกแล้ว' },
];

function formatDateTime(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function RepairManager() {
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [itemId, setItemId] = useState('');
  const [issue, setIssue] = useState('');
  const [files, setFiles] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [openRepairId, setOpenRepairId] = useState(null);

  const repairsQuery = useQuery({
    queryKey: ['repairs', statusFilter],
    queryFn: () => getRepairs({ status: statusFilter || undefined }),
  });
  // ใช้ query key เดียวกับ BorrowManager (['equipment','available']) แชร์ cache กันได้เพราะเป็นเงื่อนไขเดียวกัน
  const equipmentQuery = useQuery({
    queryKey: ['equipment', 'available'],
    queryFn: () => getEquipment({ status: 'available', limit: 500 }),
  });

  const repairs = repairsQuery.data?.repairs ?? [];
  const availableEquipment = equipmentQuery.data?.equipment ?? [];
  const pendingCount = repairs.filter(
    (repair) => repair.status === 'pending_repair',
  ).length;

  function clearMessages() {
    setError('');
    setNotice('');
  }

  function openForm() {
    clearMessages();
    setItemId('');
    setIssue('');
    setFiles([]);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  const reportMutation = useMutation({
    mutationFn: () => reportRepair({ itemId: Number(itemId), issue, files }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setNotice('แจ้งซ่อมสำเร็จ');
      closeForm();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const startMutation = useMutation({
    mutationFn: startRepair,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setNotice('เริ่มซ่อมแล้ว');
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  function submitForm(event) {
    event.preventDefault();
    clearMessages();
    reportMutation.mutate();
  }

  const loading = repairsQuery.isLoading;
  const displayError = repairsQuery.error?.message || error;

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Repair</p>
          <h2>
            แจ้งซ่อมครุภัณฑ์
            {pendingCount > 0 && (
              <span
                className="status-badge status-pending_repair"
                style={{ marginLeft: 8 }}
              >
                รอซ่อม {pendingCount}
              </span>
            )}
          </h2>
        </div>

        <div className="toolbar-actions">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="item-count">{repairs.length} รายการ</span>
          {!formOpen && (
            <button className="button-primary" type="button" onClick={openForm}>
              + แจ้งซ่อม
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
              <p className="section-kicker">New repair</p>
              <h3>แจ้งซ่อมครุภัณฑ์</h3>
            </div>
            <button className="button-secondary" type="button" onClick={closeForm}>
              ปิด
            </button>
          </div>

          <div className="form-grid">
            <label>
              ครุภัณฑ์
              <select
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                required
              >
                <option value="">เลือกครุภัณฑ์ (เฉพาะที่พร้อมใช้งาน)</option>
                {availableEquipment.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    {item.equipment_code} — {item.equipment_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-wide">
              อาการ/ปัญหาที่พบ
              <textarea
                rows={3}
                value={issue}
                onChange={(event) => setIssue(event.target.value)}
                required
              />
            </label>

            <label className="field-wide">
              ไฟล์แนบ (รูปภาพ/PDF ไม่เกิน 5 ไฟล์)
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []))
                }
              />
            </label>
          </div>

          <div className="form-actions">
            <button
              className="button-primary"
              type="submit"
              disabled={reportMutation.isPending}
            >
              {reportMutation.isPending ? 'กำลังบันทึก...' : 'แจ้งซ่อม'}
            </button>
            <button className="button-secondary" type="button" onClick={closeForm}>
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="loading-message">กำลังโหลดรายการแจ้งซ่อม...</p>
      ) : repairs.length === 0 ? (
        <div className="empty-state">
          <p>ยังไม่มีรายการแจ้งซ่อม</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="equipment-table">
            <thead>
              <tr>
                <th>ครุภัณฑ์</th>
                <th>ผู้แจ้ง</th>
                <th>วันที่แจ้ง</th>
                <th>ปัญหา</th>
                <th>สถานะ</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {repairs.map((repair) => (
                <tr key={repair.repair_id}>
                  <td>
                    <span className="equipment-code">
                      {repair.equipment_code}
                    </span>
                    <br />
                    {repair.equipment_name}
                  </td>
                  <td>{repair.reporter_name}</td>
                  <td>{formatDateTime(repair.repair_date)}</td>
                  <td>{repair.issue}</td>
                  <td>
                    <span className={`status-badge status-${repair.status}`}>
                      {statusLabels[repair.status] ?? repair.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {repair.status === 'pending_repair' && (
                        <button
                          className="button-restore"
                          type="button"
                          disabled={startMutation.isPending}
                          onClick={() => startMutation.mutate(repair.repair_id)}
                        >
                          เริ่มซ่อม
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenRepairId(repair.repair_id)}
                      >
                        รายละเอียด
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openRepairId && (
        <RepairDetailDialog
          repairId={openRepairId}
          onClose={() => setOpenRepairId(null)}
        />
      )}
    </section>
  );
}
