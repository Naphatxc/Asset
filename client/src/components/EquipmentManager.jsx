// Component หลักของโมดูลครุภัณฑ์: ถือ state และประสาน Form/Table/History กับ API
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ApiError,
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

export default function EquipmentManager({ user, onUnauthorized }) {
  const navigate = useNavigate();
  // ข้อมูลจากฐานข้อมูล
  const [equipment, setEquipment] = useState([]);
  const [deletedEquipment, setDeletedEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  // State ควบคุมหน้าจอและข้อความตอบกลับ
  const [view, setView] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formMode, setFormMode] = useState(null);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyItemId, setBusyItemId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [historyEquipment, setHistoryEquipment] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [qrEquipment, setQrEquipment] = useState(null);

  const admin = user.role === 'admin';

  // ตอนเปิด Dashboard: ทุกคนโหลดรายการ ส่วน Admin โหลดตัวเลือกสำหรับฟอร์มเพิ่มด้วย
  useEffect(() => {
    async function initialize() {
      setLoading(true);
      setError('');

      try {
        const equipmentRequest = getEquipment();

        if (admin) {
          const [equipmentData, categoryData, locationData] =
            await Promise.all([
              equipmentRequest,
              getCategories(),
              getLocations(),
            ]);

          setEquipment(equipmentData.equipment);
          setCategories(categoryData.categories);
          setLocations(locationData.locations);
        } else {
          const equipmentData = await equipmentRequest;
          setEquipment(equipmentData.equipment);
        }
      } catch (loadError) {
        handleError(loadError);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [admin]);

  // Error 401 หมายถึง Token ใช้ไม่ได้แล้ว จึงส่งกลับไปให้ App ล้าง Session
  function handleError(actionError) {
    if (actionError instanceof ApiError && actionError.status === 401) {
      onUnauthorized();
      return;
    }

    setError(actionError.message);
  }

  function clearMessages() {
    setError('');
    setNotice('');
  }

  // แยกฟังก์ชัน reload เพื่อเรียกซ้ำหลัง Create/Update/Delete/Restore
  async function reloadActiveEquipment() {
    const data = await getEquipment();
    setEquipment(data.equipment);
  }

  async function reloadDeletedEquipment() {
    const data = await getDeletedEquipment();
    setDeletedEquipment(data.equipment);
  }

  // สลับระหว่างข้อมูลที่ใช้งานอยู่กับข้อมูลที่ถูก Soft Delete
  async function switchView(nextView) {
    clearMessages();
    setView(nextView);
    setFormMode(null);
    setHistoryEquipment(null);
    setConfirmingDeleteId(null);

    if (nextView === 'deleted') {
      setLoading(true);

      try {
        await reloadDeletedEquipment();
      } catch (loadError) {
        handleError(loadError);
      } finally {
        setLoading(false);
      }
    }
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

  // Form เดียวกันเลือก Create หรือ Edit จาก formMode
  async function submitForm(payload) {
    clearMessages();
    setSubmitting(true);

    try {
      if (formMode === 'edit') {
        await updateEquipment(editingEquipment.item_id, payload);
        setNotice('แก้ไขข้อมูลครุภัณฑ์สำเร็จ');
      } else {
        await createEquipment(payload);
        setNotice('เพิ่มครุภัณฑ์สำเร็จ');
      }

      await reloadActiveEquipment();
      closeForm();
    } catch (submitError) {
      handleError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  // การเปลี่ยนสถานะแยก endpoint จากการแก้ข้อมูลทั่วไป เพื่อให้ History ชัดเจน
  async function changeStatus(item, status) {
    clearMessages();
    setBusyItemId(item.item_id);

    try {
      await updateEquipmentStatus(item.item_id, status);
      await reloadActiveEquipment();
      setNotice(`เปลี่ยนสถานะ ${item.equipment_code} สำเร็จ`);
    } catch (statusError) {
      handleError(statusError);
    } finally {
      setBusyItemId(null);
    }
  }

  // ครั้งแรกเป็นเพียงเปิดโหมดยืนยัน ครั้งที่สองจึงยิง DELETE API
  async function removeItem(item) {
    if (confirmingDeleteId !== item.item_id) {
      setConfirmingDeleteId(item.item_id);
      setNotice('กด “ยืนยันลบ” อีกครั้งเพื่อลบแบบ Soft Delete');
      return;
    }

    clearMessages();
    setBusyItemId(item.item_id);

    try {
      await deleteEquipment(item.item_id);
      await reloadActiveEquipment();
      setNotice(`ลบ ${item.equipment_code} แล้ว สามารถกู้คืนได้`);
    } catch (deleteError) {
      handleError(deleteError);
    } finally {
      setBusyItemId(null);
      setConfirmingDeleteId(null);
    }
  }

  // Restore ทำให้ deleted_at กลับเป็น null แล้วโหลดทั้งสองรายการใหม่
  async function restoreItem(item) {
    clearMessages();
    setBusyItemId(item.item_id);

    try {
      await restoreEquipment(item.item_id);
      await Promise.all([
        reloadActiveEquipment(),
        reloadDeletedEquipment(),
      ]);
      setNotice(`กู้คืน ${item.equipment_code} สำเร็จ`);
    } catch (restoreError) {
      handleError(restoreError);
    } finally {
      setBusyItemId(null);
    }
  }

  // History โหลดเมื่อผู้ใช้ขอดูเท่านั้น เพื่อลด request ตอนเปิดหน้า
  async function openHistory(item) {
    clearMessages();
    setFormMode(null);
    setHistoryEquipment(item);
    setHistory([]);
    setHistoryLoading(true);

    try {
      const data = await getEquipmentHistory(item.item_id);
      setHistory(data.history);
    } catch (historyError) {
      handleError(historyError);
    } finally {
      setHistoryLoading(false);
    }
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

      {error && <p className="error-message">{error}</p>}
      {notice && <p className="success-message">{notice}</p>}

      {formMode && (
        <EquipmentForm
          equipment={editingEquipment}
          categories={categories}
          locations={locations}
          submitting={submitting}
          onSubmit={submitForm}
          onCancel={closeForm}
        />
      )}

      {historyEquipment && (
        <EquipmentHistory
          equipment={historyEquipment}
          history={history}
          loading={historyLoading}
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
