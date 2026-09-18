import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  getCategories,
  getEquipmentByCode,
  getLocations,
  updateEquipment,
} from '../../api/equipment.js';
import EquipmentForm from '../../components/EquipmentForm.jsx';
import QrCodeDialog from '../../components/QrCodeDialog.jsx';
import { useToast } from '../../components/ToastProvider.jsx';

const statusLabels = {
  available: 'พร้อมใช้งาน',
  borrowed: 'ถูกยืม',
  pending_repair: 'รอซ่อม',
  repairing: 'กำลังซ่อม',
};

function formatDate(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
  }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`));
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '-';

  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(Number(value));
}

function formatLocation(equipment) {
  const parts = [
    equipment.location_name,
    equipment.building,
    equipment.room ? `ห้อง ${equipment.room}` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'ยังไม่ระบุสถานที่';
}

export default function EquipmentDetailPage({ user, onLogout }) {
  const { code = '' } = useParams();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [showQr, setShowQr] = useState(false);
  const [editing, setEditing] = useState(false);
  const admin = user.role === 'admin';

  const equipmentQuery = useQuery({
    queryKey: ['equipment', code],
    queryFn: () => getEquipmentByCode(code),
  });
  // ตัวเลือกของฟอร์มแก้ไขมีแต่ Admin เห็น จึงโหลดเมื่อกดแก้ไขเท่านั้น
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    enabled: editing,
  });
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
    enabled: editing,
  });

  const equipment = equipmentQuery.data?.equipment ?? null;
  const categories = categoriesQuery.data?.categories ?? [];
  const locations = locationsQuery.data?.locations ?? [];
  const optionsError = categoriesQuery.error?.message || locationsQuery.error?.message;

  const updateMutation = useMutation({
    mutationFn: (payload) => updateEquipment(equipment.item_id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', code] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setEditing(false);
      showSuccess('แก้ไขข้อมูลครุภัณฑ์สำเร็จ');
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  function openEditForm() {
    setEditing(true);
  }

  function submitEdit(payload) {
    updateMutation.mutate(payload);
  }

  if (equipmentQuery.isLoading) {
    return (
      <main className="app-shell">
        <p className="loading-message">กำลังโหลดข้อมูลครุภัณฑ์...</p>
      </main>
    );
  }

  if (!equipment) {
    const errorStatus = equipmentQuery.error?.status;

    return (
      <main className="app-shell">
        <section className="welcome-card centered-state">
          <p className="eyebrow">{errorStatus === 404 ? '404' : 'Error'}</p>
          <h1>{errorStatus === 404 ? 'ไม่พบครุภัณฑ์' : 'โหลดข้อมูลไม่สำเร็จ'}</h1>
          <p>{equipmentQuery.error?.message || 'กรุณาลองใหม่อีกครั้ง'}</p>
          <Link className="button-link button-primary" to="/">
            กลับหน้าหลัก
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell detail-shell">
      <section className="welcome-card equipment-detail-card">
        <header className="detail-header">
          <div>
            <p className="eyebrow">Equipment detail</p>
            <h1>{equipment.equipment_name}</h1>
            <span className="equipment-code detail-code">
              {equipment.equipment_code}
            </span>
          </div>
          <div className="account-summary detail-account">
            <span>{user.name}</span>
            <span className="role-badge">
              {admin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
            </span>
          </div>
        </header>

        {editing ? (
          <>
            {optionsError && <p className="error-message">{optionsError}</p>}
            <EquipmentForm
              equipment={equipment}
              categories={categories}
              locations={locations}
              submitting={updateMutation.isPending}
              onSubmit={submitEdit}
              onCancel={() => setEditing(false)}
            />
          </>
        ) : (
          <dl className="detail-grid">
            <div>
              <dt>สถานะ</dt>
              <dd>
                <span
                  className={`status-badge status-${equipment.status}`}
                >
                  {statusLabels[equipment.status] ?? equipment.status}
                </span>
              </dd>
            </div>
            <div>
              <dt>หมวดหมู่</dt>
              <dd>{equipment.category_name}</dd>
            </div>
            <div>
              <dt>สถานที่</dt>
              <dd>{formatLocation(equipment)}</dd>
            </div>
            <div>
              <dt>ราคา</dt>
              <dd>{formatPrice(equipment.price)}</dd>
            </div>
            <div>
              <dt>ปีงบประมาณ</dt>
              <dd>{equipment.fiscal_year ?? '-'}</dd>
            </div>
            <div>
              <dt>วันที่รับ</dt>
              <dd>{formatDate(equipment.receive_date)}</dd>
            </div>
            <div>
              <dt>หมดประกัน</dt>
              <dd>{formatDate(equipment.warranty_expire)}</dd>
            </div>
            <div className="detail-wide">
              <dt>รายละเอียด</dt>
              <dd>{equipment.description || '-'}</dd>
            </div>
            <div className="detail-wide">
              <dt>หมายเหตุ</dt>
              <dd>{equipment.remark || '-'}</dd>
            </div>
          </dl>
        )}

        <div className="detail-actions">
          <Link className="button-link button-secondary" to="/?tab=equipment">
            กลับหน้ารายการ
          </Link>
          {admin && !editing && (
            <>
              <button
                className="button-secondary"
                type="button"
                onClick={openEditForm}
              >
                แก้ไขข้อมูล
              </button>
              <button
                className="button-primary"
                type="button"
                onClick={() => setShowQr(true)}
              >
                ดู QR Code
              </button>
            </>
          )}
          <button
            className="logout-button detail-logout"
            type="button"
            onClick={onLogout}
          >
            ออกจากระบบ
          </button>
        </div>
      </section>

      {showQr && (
        <QrCodeDialog
          equipment={equipment}
          onClose={() => setShowQr(false)}
        />
      )}
    </main>
  );
}
