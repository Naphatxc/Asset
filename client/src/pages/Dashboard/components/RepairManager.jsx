// จัดการแจ้งซ่อมครุภัณฑ์ — Admin: ทุกรายการ + ดูรายละเอียด/เริ่มซ่อม/บันทึกผลซ่อม/ยกเลิก อยู่ใน RepairDetailDialog
// mine (User ทั่วไป): แจ้งซ่อมได้ และเห็นเฉพาะรายการที่ตัวเองแจ้ง ดูรายละเอียดได้อย่างเดียว
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { getAvailableEquipment } from '../../../api/equipment.js';
import { getMyRepairs, getRepairs, reportRepair, startRepair } from '../../../api/repair.js';
import FileDropInput from '../../../components/FileDropInput.jsx';
import PaginationBar, { paginateRows } from '../../../components/PaginationBar.jsx';
import SearchableSelect from '../../../components/SearchableSelect.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
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

export default function RepairManager({ mine = false }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [issue, setIssue] = useState('');
  const [files, setFiles] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [openRepairId, setOpenRepairId] = useState(null);

  // รายการของตัวเองมีไม่มาก ดึงมาทั้งหมดแล้วกรองสถานะฝั่ง client ส่วนของ Admin กรองที่ server
  const repairsQuery = useQuery({
    queryKey: mine ? ['repairs', 'mine'] : ['repairs', statusFilter],
    queryFn: () => (mine ? getMyRepairs() : getRepairs({ status: statusFilter || undefined })),
  });
  // ใช้ query key เดียวกับ BorrowManager (['equipment','available']) แชร์ cache กันได้เพราะเป็นเงื่อนไขเดียวกัน
  const equipmentQuery = useQuery({
    queryKey: ['equipment', 'available'],
    queryFn: getAvailableEquipment,
  });

  const allRepairs = repairsQuery.data?.repairs ?? [];
  const repairs =
    mine && statusFilter
      ? allRepairs.filter((repair) => repair.status === statusFilter)
      : allRepairs;
  // server ส่งมาทั้งหมด แบ่งหน้าฝั่ง client ให้หน้าตาเหมือนแท็บครุภัณฑ์/วัสดุ
  const { rows: pageRepairs, pagination } = paginateRows(repairs, page);
  const availableEquipment = equipmentQuery.data?.equipment ?? [];

  // แปลงเป็น { value, label } ให้ SearchableSelect ใช้ตรงกัน ค้นหาได้ทั้งรหัสและชื่อครุภัณฑ์
  const equipmentOptions = useMemo(
    () =>
      availableEquipment.map((item) => ({
        value: String(item.item_id),
        label: `${item.equipment_code} — ${item.equipment_name}`,
      })),
    [availableEquipment],
  );

  const pendingCount = repairs.filter(
    (repair) => repair.status === 'pending_repair',
  ).length;

  function openForm() {
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
      showSuccess('แจ้งซ่อมสำเร็จ');
      closeForm();
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const startMutation = useMutation({
    mutationFn: startRepair,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      showSuccess('เริ่มซ่อมแล้ว');
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  function submitForm(event) {
    event.preventDefault();
    reportMutation.mutate();
  }

  const loading = repairsQuery.isLoading;
  const displayError = repairsQuery.error?.message;

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Repair</p>
          <h2>
            {mine ? 'แจ้งซ่อมของฉัน' : 'แจ้งซ่อมครุภัณฑ์'}
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
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
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
              <SearchableSelect
                name="itemId"
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                required
                emptyLabel="เลือกครุภัณฑ์ (เฉพาะที่พร้อมใช้งาน)"
                placeholder="พิมพ์รหัสหรือชื่อครุภัณฑ์เพื่อค้นหา..."
                options={equipmentOptions}
              />
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
              <FileDropInput
                files={files}
                onChange={setFiles}
                accept="image/jpeg,image/png,image/webp,application/pdf"
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
          <table className="equipment-table responsive-table">
            <thead>
              <tr>
                <th>ครุภัณฑ์</th>
                {!mine && <th>ผู้แจ้ง</th>}
                <th>วันที่แจ้ง</th>
                <th>ปัญหา</th>
                <th>สถานะ</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {pageRepairs.map((repair) => (
                <tr key={repair.repair_id}>
                  <td data-label="ครุภัณฑ์">
                    <span className="equipment-code">
                      {repair.equipment_code}
                    </span>
                    <br />
                    {repair.equipment_name}
                  </td>
                  {!mine && <td data-label="ผู้แจ้ง">{repair.reporter_name}</td>}
                  <td data-label="วันที่แจ้ง">{formatDateTime(repair.repair_date)}</td>
                  <td data-label="ปัญหา">{repair.issue}</td>
                  <td data-label="สถานะ">
                    <span className={`status-badge status-${repair.status}`}>
                      {statusLabels[repair.status] ?? repair.status}
                    </span>
                  </td>
                  <td className="stack-actions">
                    <div className="row-actions">
                      {!mine && repair.status === 'pending_repair' && (
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

      {!loading && <PaginationBar pagination={pagination} onPageChange={setPage} />}

      {openRepairId && (
        <RepairDetailDialog
          repairId={openRepairId}
          mine={mine}
          onClose={() => setOpenRepairId(null)}
        />
      )}
    </section>
  );
}
