// Dialog ดูรายละเอียดรายการแจ้งซ่อม + แนบไฟล์เพิ่ม/บันทึกผลซ่อมเสร็จ/ยกเลิก แล้วแต่สถานะปัจจุบัน
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  addRepairFiles,
  cancelRepair,
  completeRepair,
  getRepairDetail,
  getRepairFileUrl,
  startRepair,
} from '../../../api/repair.js';
import FileDropInput from '../../../components/FileDropInput.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';

const statusLabels = {
  pending_repair: 'รอซ่อม',
  repairing: 'กำลังซ่อม',
  completed: 'ซ่อมเสร็จแล้ว',
  cancelled: 'ยกเลิกแล้ว',
};

function formatDateTime(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCost(value) {
  if (value === null || value === undefined || value === '') return '-';

  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export default function RepairDetailDialog({ repairId, onClose }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [repairDetail, setRepairDetail] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);

  const repairQuery = useQuery({
    queryKey: ['repair', repairId],
    queryFn: () => getRepairDetail(repairId),
  });
  const repair = repairQuery.data?.repair;

  function refresh(message) {
    queryClient.invalidateQueries({ queryKey: ['repair', repairId] });
    queryClient.invalidateQueries({ queryKey: ['repairs'] });
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    showSuccess(message);
  }

  const startMutation = useMutation({
    mutationFn: () => startRepair(repairId),
    onSuccess: () => refresh('เริ่มซ่อมแล้ว'),
    onError: (mutationError) => showError(mutationError.message),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      completeRepair(repairId, {
        repairDetail,
        repairCost: repairCost === '' ? null : Number(repairCost),
      }),
    onSuccess: () => refresh('บันทึกผลการซ่อมสำเร็จ'),
    onError: (mutationError) => showError(mutationError.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRepair(repairId),
    onSuccess: () => refresh('ยกเลิกการแจ้งซ่อมแล้ว'),
    onError: (mutationError) => showError(mutationError.message),
  });

  const addFilesMutation = useMutation({
    mutationFn: () => addRepairFiles(repairId, pendingFiles),
    onSuccess: () => {
      setPendingFiles([]);
      refresh('แนบไฟล์สำเร็จ');
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const busy =
    startMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending ||
    addFilesMutation.isPending;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="repair-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Repair</p>
            <h2 id="repair-dialog-title">รายละเอียดการแจ้งซ่อม</h2>
          </div>
          <button className="button-secondary" type="button" onClick={onClose}>
            ปิด
          </button>
        </div>

        {repairQuery.isLoading && <p className="loading-message">กำลังโหลด...</p>}
        {repairQuery.error && (
          <p className="error-message">{repairQuery.error.message}</p>
        )}

        {repair && (
          <>
            <dl className="repair-detail-grid">
              <dt>ครุภัณฑ์</dt>
              <dd>
                <span className="equipment-code">{repair.equipment_code}</span>{' '}
                {repair.equipment_name}
              </dd>

              <dt>สถานะ</dt>
              <dd>
                <span className={`status-badge status-${repair.status}`}>
                  {statusLabels[repair.status] ?? repair.status}
                </span>
              </dd>

              <dt>ผู้แจ้งซ่อม</dt>
              <dd>{repair.reporter_name}</dd>

              <dt>วันที่แจ้งซ่อม</dt>
              <dd>{formatDateTime(repair.repair_date)}</dd>

              <dt>อาการ/ปัญหาที่แจ้ง</dt>
              <dd>{repair.issue}</dd>

              {repair.repair_detail && (
                <>
                  <dt>ผลการซ่อม</dt>
                  <dd>{repair.repair_detail}</dd>
                </>
              )}

              {repair.status === 'completed' && (
                <>
                  <dt>ค่าใช้จ่ายในการซ่อม</dt>
                  <dd>{formatCost(repair.repair_cost)}</dd>
                </>
              )}
            </dl>

            <div>
              <p className="section-kicker">ไฟล์แนบ</p>
              {repair.files.length === 0 ? (
                <p className="loading-message">ยังไม่มีไฟล์แนบ</p>
              ) : (
                <ul className="file-list">
                  {repair.files.map((file) => (
                    <li key={file.file_id}>
                      <a
                        className="file-chip"
                        href={getRepairFileUrl(file.file_id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.file_name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              <FileDropInput
                files={pendingFiles}
                onChange={setPendingFiles}
                accept="image/jpeg,image/png,image/webp,application/pdf"
              />

              <div className="form-actions">
                <button
                  className="button-secondary"
                  type="button"
                  disabled={pendingFiles.length === 0 || busy}
                  onClick={() => addFilesMutation.mutate()}
                >
                  แนบไฟล์เพิ่ม
                </button>
              </div>
            </div>

            {repair.status === 'pending_repair' && (
              <div className="form-actions">
                <button
                  className="button-primary"
                  type="button"
                  disabled={busy}
                  onClick={() => startMutation.mutate()}
                >
                  เริ่มซ่อม
                </button>
                <button
                  className="button-danger"
                  type="button"
                  disabled={busy}
                  onClick={() => cancelMutation.mutate()}
                >
                  ยกเลิกการแจ้งซ่อม
                </button>
              </div>
            )}

            {repair.status === 'repairing' && (
              <form
                className="equipment-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  completeMutation.mutate();
                }}
              >
                <div className="form-heading">
                  <div>
                    <p className="section-kicker">Complete repair</p>
                    <h3>บันทึกผลการซ่อม</h3>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="field-wide">
                    รายละเอียดผลการซ่อม
                    <textarea
                      rows={3}
                      value={repairDetail}
                      onChange={(event) => setRepairDetail(event.target.value)}
                      required
                    />
                  </label>

                  <label>
                    ค่าใช้จ่ายในการซ่อม (บาท)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={repairCost}
                      onChange={(event) => setRepairCost(event.target.value)}
                    />
                  </label>
                </div>

                <div className="form-actions">
                  <button className="button-primary" type="submit" disabled={busy}>
                    {completeMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกว่าซ่อมเสร็จ'}
                  </button>
                  <button
                    className="button-danger"
                    type="button"
                    disabled={busy}
                    onClick={() => cancelMutation.mutate()}
                  >
                    ยกเลิกการแจ้งซ่อม
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
