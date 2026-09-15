// Component หลักของโมดูลครุภัณฑ์: TanStack Query ดูแล data fetching/cache/loading/error ทั้งหมด
// เหลือแค่ state ที่เป็น UI ล้วนๆ (view, formMode, ข้อความยืนยัน ฯลฯ) — 401 จัดการที่ main.jsx จุดเดียว
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  createEquipment,
  deleteEquipment,
  getCategories,
  getDeletedEquipment,
  getEquipment,
  getEquipmentHistory,
  getLocations,
  restoreEquipment,
  updateEquipment,
  updateEquipmentStatus,
} from '../api/equipment.js';
import EquipmentForm from './EquipmentForm.jsx';
import EquipmentHistory from './EquipmentHistory.jsx';
import EquipmentTable from './EquipmentTable.jsx';
import QrCodeDialog from './QrCodeDialog.jsx';

export default function EquipmentManager({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const admin = user.role === 'admin';

  // State ควบคุมหน้าจอเท่านั้น (ไม่ใช่ข้อมูลจาก server)
  const [view, setView] = useState('active');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formMode, setFormMode] = useState(null);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [historyEquipment, setHistoryEquipment] = useState(null);
  const [qrEquipment, setQrEquipment] = useState(null);

  const equipmentQuery = useQuery({
    queryKey: ['equipment'],
    queryFn: getEquipment,
  });
  // เฉพาะ Admin เท่านั้นที่มีปุ่มดูรายการที่ถูกลบ จึงโหลดเมื่อจำเป็นจริงๆ
  const deletedEquipmentQuery = useQuery({
    queryKey: ['equipment', 'deleted'],
    queryFn: getDeletedEquipment,
    enabled: admin && view === 'deleted',
  });
  // ใช้เป็นตัวเลือกใน Form เพิ่ม/แก้ไข ซึ่งมีแต่ Admin เห็น
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    enabled: admin,
  });
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
    enabled: admin,
  });
  const historyQuery = useQuery({
    queryKey: ['equipment', historyEquipment?.item_id, 'history'],
    queryFn: () => getEquipmentHistory(historyEquipment.item_id),
    enabled: historyEquipment != null,
  });

  const equipment = equipmentQuery.data?.equipment ?? [];
  const deletedEquipment = deletedEquipmentQuery.data?.equipment ?? [];
  const categories = categoriesQuery.data?.categories ?? [];
  const locations = locationsQuery.data?.locations ?? [];
  const history = historyQuery.data?.history ?? [];

  function invalidateEquipmentLists() {
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
  }

  // Form เดียวกันเลือก Create หรือ Edit จาก formMode
  const saveEquipmentMutation = useMutation({
    mutationFn: (payload) =>
      formMode === 'edit'
        ? updateEquipment(editingEquipment.item_id, payload)
        : createEquipment(payload),
    onSuccess: () => {
      invalidateEquipmentLists();
      setNotice(
        formMode === 'edit'
          ? 'แก้ไขข้อมูลครุภัณฑ์สำเร็จ'
          : 'เพิ่มครุภัณฑ์สำเร็จ',
      );
      closeForm();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  // การเปลี่ยนสถานะแยก endpoint จากการแก้ข้อมูลทั่วไป เพื่อให้ History ชัดเจน
  const statusMutation = useMutation({
    mutationFn: ({ item, status }) =>
      updateEquipmentStatus(item.item_id, status),
    onSuccess: (_data, { item }) => {
      invalidateEquipmentLists();
      setNotice(`เปลี่ยนสถานะ ${item.equipment_code} สำเร็จ`);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (item) => deleteEquipment(item.item_id),
    onSuccess: (_data, item) => {
      invalidateEquipmentLists();
      queryClient.invalidateQueries({ queryKey: ['equipment', 'deleted'] });
      setNotice(`ลบ ${item.equipment_code} แล้ว สามารถกู้คืนได้`);
      setConfirmingDeleteId(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  // Restore ทำให้ deleted_at กลับเป็น null แล้วให้ทั้งสอง query invalidate ไปโหลดใหม่เอง
  const restoreMutation = useMutation({
    mutationFn: (item) => restoreEquipment(item.item_id),
    onSuccess: (_data, item) => {
      invalidateEquipmentLists();
      queryClient.invalidateQueries({ queryKey: ['equipment', 'deleted'] });
      setNotice(`กู้คืน ${item.equipment_code} สำเร็จ`);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  // ปุ่มของแถวไหนกำลังถูก mutate อยู่ ใช้ disable เฉพาะแถวนั้นระหว่างรอผล (item_id ไม่มีทางเป็น 0)
  const busyItemId =
    (statusMutation.isPending && statusMutation.variables?.item?.item_id) ||
    (deleteMutation.isPending && deleteMutation.variables?.item_id) ||
    (restoreMutation.isPending && restoreMutation.variables?.item_id) ||
    null;

  const activeListQuery = view === 'active' ? equipmentQuery : deletedEquipmentQuery;
  const loading = activeListQuery.isLoading;
  // ให้ความสำคัญกับ error ตอนโหลดรายการก่อน ถ้าโหลดได้ปกติค่อยแสดง error ของ action ล่าสุด (ถ้ามี)
  const displayError = activeListQuery.error?.message || error;
  const optionsError = categoriesQuery.error?.message || locationsQuery.error?.message;

  function clearMessages() {
    setError('');
    setNotice('');
  }

  // สลับระหว่างข้อมูลที่ใช้งานอยู่กับข้อมูลที่ถูก Soft Delete
  function switchView(nextView) {
    clearMessages();
    setView(nextView);
    setFormMode(null);
    setHistoryEquipment(null);
    setConfirmingDeleteId(null);
  }

  function openCreateForm() {
    clearMessages();
    setEditingEquipment(null);
    setHistoryEquipment(null);
    setFormMode('create');
  }

  function openEditForm(item) {
    clearMessages();
    setEditingEquipment(item);
    setHistoryEquipment(null);
    setFormMode('edit');
  }

  function closeForm() {
    setFormMode(null);
    setEditingEquipment(null);
  }

  function submitForm(payload) {
    clearMessages();
    saveEquipmentMutation.mutate(payload);
  }

  function changeStatus(item, status) {
    clearMessages();
    statusMutation.mutate({ item, status });
  }

  // ครั้งแรกเป็นเพียงเปิดโหมดยืนยัน ครั้งที่สองจึงยิง DELETE API
  function removeItem(item) {
    if (confirmingDeleteId !== item.item_id) {
      setConfirmingDeleteId(item.item_id);
      setNotice('กด “ยืนยันลบ” อีกครั้งเพื่อลบแบบ Soft Delete');
      return;
    }

    clearMessages();
    deleteMutation.mutate(item);
  }

  function restoreItem(item) {
    clearMessages();
    restoreMutation.mutate(item);
  }

  // History โหลดเมื่อผู้ใช้ขอดูเท่านั้น (enabled: historyEquipment != null) เพื่อลด request ตอนเปิดหน้า
  function openHistory(item) {
    clearMessages();
    setFormMode(null);
    setHistoryEquipment(item);
  }

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Equipment</p>
          <h2>
            {view === 'active'
              ? 'รายการครุภัณฑ์'
              : 'ครุภัณฑ์ที่ถูกลบ'}
          </h2>
        </div>

        <div className="toolbar-actions">
          <span className="item-count">
            {view === 'active'
              ? equipment.length
              : deletedEquipment.length}{' '}
            รายการ
          </span>

          {admin && (
            <>
              <button
                className="button-secondary"
                type="button"
                onClick={() =>
                  switchView(
                    view === 'active' ? 'deleted' : 'active',
                  )
                }
              >
                {view === 'active'
                  ? 'รายการที่ลบ'
                  : 'รายการปัจจุบัน'}
              </button>

              {view === 'active' && (
                <button
                  className="button-primary"
                  type="button"
                  onClick={openCreateForm}
                >
                  + เพิ่มครุภัณฑ์
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {displayError && <p className="error-message">{displayError}</p>}
      {notice && <p className="success-message">{notice}</p>}

      {formMode && (
        <>
          {optionsError && <p className="error-message">{optionsError}</p>}
          <EquipmentForm
            equipment={editingEquipment}
            categories={categories}
            locations={locations}
            submitting={saveEquipmentMutation.isPending}
            onSubmit={submitForm}
            onCancel={closeForm}
          />
        </>
      )}

      {historyEquipment && (
        <EquipmentHistory
          equipment={historyEquipment}
          history={history}
          loading={historyQuery.isLoading}
          onClose={() => setHistoryEquipment(null)}
        />
      )}

      {qrEquipment && (
        <QrCodeDialog
          equipment={qrEquipment}
          onClose={() => setQrEquipment(null)}
        />
      )}

      {loading ? (
        <p className="loading-message">กำลังโหลดครุภัณฑ์...</p>
      ) : (
        <EquipmentTable
          equipment={
            view === 'active' ? equipment : deletedEquipment
          }
          admin={admin}
          mode={view}
          busyItemId={busyItemId}
          confirmingDeleteId={confirmingDeleteId}
          onViewDetails={(item) =>
            navigate(
              `/equipment/${encodeURIComponent(item.equipment_code)}`,
            )
          }
          onShowQr={setQrEquipment}
          onEdit={openEditForm}
          onStatusChange={changeStatus}
          onHistory={openHistory}
          onDelete={removeItem}
          onCancelDelete={() => {
            setConfirmingDeleteId(null);
            setNotice('');
          }}
          onRestore={restoreItem}
        />
      )}
    </section>
  );
}
