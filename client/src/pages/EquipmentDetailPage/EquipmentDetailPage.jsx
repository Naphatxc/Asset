import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  applyEquipmentImageChange,
  getCategories,
  getEquipmentByCode,
  getLocations,
  updateEquipment,
} from '../../api/equipment.js';
import { toApiUrl } from '../../api/http.js';
import EquipmentForm from '../../components/EquipmentForm.jsx';
import QrCodeDialog from '../../components/QrCodeDialog.jsx';
import { useToast } from '../../components/ToastProvider.jsx';

const statusLabels = {
  available: 'พร้อมใช้งาน',
  borrowed: 'ถูกยืม',
  pending_repair: 'รอซ่อม',
  repairing: 'กำลังซ่อม',
  damaged: 'ชำรุด',
  disposed: 'จำหน่ายออก',
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

export default function EquipmentDetailPage({ user }) {
  const { code = '' } = useParams();
  // มาจาก navigate(..., { state }) ตอนกด "รายละเอียด" ใน EquipmentManager.jsx — พาไปหน้า/ตัวกรองเดิมที่
  // เพิ่งดูอยู่แทนที่จะเด้งกลับหน้าแรกเสมอ ถ้าเข้าหน้านี้ตรงๆ (เช่น สแกน QR) จะไม่มี state นี้ จึง fallback
  const location = useLocation();
  const returnTo = location.state?.returnTo ?? '/?tab=equipment';
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

  // รูปบันทึกแยกหลังข้อมูลสำเร็จ เหมือน EquipmentManager.jsx
  const updateMutation = useMutation({
    mutationFn: async ({ payload, imageChange }) => {
      // payload เป็น null = แก้แค่รูปอย่างเดียว (ดู EquipmentForm.jsx)
      if (payload) await updateEquipment(equipment.item_id, payload);

      try {
        await applyEquipmentImageChange(equipment.item_id, imageChange);
        return { imageError: null };
      } catch (imageError) {
        return { imageError: imageError.message };
      }
    },
    onSuccess: ({ imageError }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment', code] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setEditing(false);
      if (imageError) {
        showError(`บันทึกข้อมูลครุภัณฑ์แล้ว แต่บันทึกรูปไม่สำเร็จ: ${imageError}`);
      } else {
        showSuccess('แก้ไขข้อมูลครุภัณฑ์สำเร็จ');
      }
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  function openEditForm() {
    setEditing(true);
  }

  function submitEdit(payload, imageChange) {
    updateMutation.mutate({ payload, imageChange });
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
            {equipment.image_url && (
              <div className="detail-wide detail-image">
                <dt>รูปครุภัณฑ์</dt>
                <dd>
                  <a href={toApiUrl(equipment.image_url)} target="_blank" rel="noreferrer">
                    <img src={toApiUrl(equipment.image_url)} alt={equipment.equipment_name} />
                  </a>
                </dd>
              </div>
            )}
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
              {/* DB เก็บ ค.ศ. แสดงเป็น พ.ศ. */}
              <dd>{equipment.fiscal_year ? equipment.fiscal_year + 543 : '-'}</dd>
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
          <Link className="button-link button-secondary" to={returnTo}>
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
