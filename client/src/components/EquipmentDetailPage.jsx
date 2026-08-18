import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  ApiError,
  getCategories,
  getEquipmentByCode,
  getLocations,
  updateEquipment,
} from '../api/equipment.js';
import EquipmentForm from './EquipmentForm.jsx';
import QrCodeDialog from './QrCodeDialog.jsx';

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

export default function EquipmentDetailPage({
  user,
  onUnauthorized,
  onLogout,
}) {
  const { code = '' } = useParams();
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const admin = user.role === 'admin';

  async function loadEquipment() {
    const data = await getEquipmentByCode(code);
    setEquipment(data.equipment);
  }

  function handleApiError(apiError) {
    if (apiError instanceof ApiError && apiError.status === 401) {
      onUnauthorized();
      return;
    }

    setErrorStatus(apiError.status ?? 500);
    setError(apiError.message);
  }

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      setError('');
      setErrorStatus(null);

      try {
        await loadEquipment();
      } catch (loadError) {
        handleApiError(loadError);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [code]);

  async function openEditForm() {
    setError('');
    setNotice('');

    try {
      const [categoryData, locationData] = await Promise.all([
        getCategories(),
        getLocations(),
      ]);
      setCategories(categoryData.categories);
      setLocations(locationData.locations);
      setEditing(true);
    } catch (loadError) {
      handleApiError(loadError);
    }
  }

  async function submitEdit(payload) {
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      await updateEquipment(equipment.item_id, payload);
      await loadEquipment();
      setEditing(false);
      setNotice('แก้ไขข้อมูลครุภัณฑ์สำเร็จ');
    } catch (updateError) {
      handleApiError(updateError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <p className="loading-message">กำลังโหลดข้อมูลครุภัณฑ์...</p>
      </main>
    );
  }

  if (!equipment) {
    return (
      <main className="app-shell">
        <section className="welcome-card centered-state">
          <p className="eyebrow">{errorStatus === 404 ? '404' : 'Error'}</p>
          <h1>{errorStatus === 404 ? 'ไม่พบครุภัณฑ์' : 'โหลดข้อมูลไม่สำเร็จ'}</h1>
          <p>{error || 'กรุณาลองใหม่อีกครั้ง'}</p>
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

        {error && <p className="error-message">{error}</p>}
        {notice && <p className="success-message">{notice}</p>}

        {editing ? (
          <EquipmentForm
            equipment={equipment}
            categories={categories}
            locations={locations}
            submitting={submitting}
            onSubmit={submitEdit}
            onCancel={() => setEditing(false)}
          />
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
          <Link className="button-link button-secondary" to="/">
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
