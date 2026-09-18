// Component หลักของโมดูลวัสดุ — โครงเดียวกับ EquipmentManager.jsx (TanStack Query ดูแล fetching/cache ทั้งหมด)
// ต่างจากครุภัณฑ์ตรงที่ทุก role (ไม่ใช่แค่ Admin) เบิกวัสดุได้เอง ตัดยอดทันทีไม่ต้องรออนุมัติ ส่วนเพิ่ม/แก้ไข/ลบ/
// กู้คืน/ดูประวัติการเบิกทั้งหมด ยังสงวนให้ Admin เหมือนเดิม
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { createCategory, getCategories } from '../../../api/equipment.js';
import {
  createMaterial,
  deleteMaterial,
  getDeletedMaterials,
  getMaterialWithdrawals,
  getMaterials,
  restoreMaterial,
  updateMaterial,
  withdrawMaterial,
} from '../../../api/materials.js';
import { categoryCreateFields } from '../../../components/EquipmentForm.jsx';
import MaterialForm from '../../../components/MaterialForm.jsx';
import SelectWithCreate from '../../../components/SelectWithCreate.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import WithdrawMaterialDialog from '../../../components/WithdrawMaterialDialog.jsx';

const PAGE_SIZE = 20;

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return '-';

  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2,
  }).format(Number(price));
}

function formatDate(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

function formatDateTime(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function MaterialManager({ user }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const admin = user.role === 'admin';

  const [initialParams] = useSearchParams();

  // view: 'active' (ทุกคนเห็น) / 'deleted' | 'withdrawals' (เฉพาะ Admin — เหมือน view toggle ของครุภัณฑ์)
  const [view, setView] = useState('active');
  const [formMode, setFormMode] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [withdrawingMaterial, setWithdrawingMaterial] = useState(null);
  const [searchInput, setSearchInput] = useState(initialParams.get('search') ?? '');
  const [search, setSearch] = useState(initialParams.get('search') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(initialParams.get('category') ?? '');
  const [page, setPage] = useState(() => {
    const initialPage = Number(initialParams.get('page'));
    return Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1;
  });

  // ดีเลย์ยิง API 400ms หลังพิมพ์หยุด (เหมือน EquipmentManager.jsx — เทียบค่ากับ ref กัน StrictMode dev
  // เรียก effect ซ้ำตอน mount จนรีเซ็ต page ทับค่าที่กู้มาจาก URL)
  const appliedSearchRef = useRef(searchInput);

  useEffect(() => {
    if (searchInput === appliedSearchRef.current) return;

    const timer = setTimeout(() => {
      appliedSearchRef.current = searchInput;
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const listParams = { page, limit: PAGE_SIZE, search, categoryId: categoryFilter };

  const materialsQuery = useQuery({
    queryKey: ['materials', 'active', listParams],
    queryFn: () => getMaterials(listParams),
    enabled: view === 'active',
    placeholderData: keepPreviousData,
  });
  const deletedMaterialsQuery = useQuery({
    queryKey: ['materials', 'deleted', listParams],
    queryFn: () => getDeletedMaterials(listParams),
    enabled: admin && view === 'deleted',
    placeholderData: keepPreviousData,
  });
  const withdrawalsQuery = useQuery({
    queryKey: ['materials', 'withdrawals', page],
    queryFn: () => getMaterialWithdrawals({ page, limit: PAGE_SIZE }),
    enabled: admin && view === 'withdrawals',
    placeholderData: keepPreviousData,
  });
  // ใช้ categories ร่วมกับครุภัณฑ์ (ตารางเดียวกัน) ทั้ง dropdown กรองรายการและฟอร์มเพิ่ม/แก้ไข
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const activeListQuery =
    view === 'active'
      ? materialsQuery
      : view === 'deleted'
        ? deletedMaterialsQuery
        : withdrawalsQuery;
  const materials =
    view === 'withdrawals' ? [] : activeListQuery.data?.materials ?? [];
  const withdrawals =
    view === 'withdrawals' ? activeListQuery.data?.withdrawals ?? [] : [];
  const pagination = activeListQuery.data?.pagination;
  const categories = categoriesQuery.data?.categories ?? [];
  const categoryOptions = categories.map((category) => ({
    value: String(category.category_id),
    label: category.category_name,
  }));

  function invalidateMaterialLists() {
    queryClient.invalidateQueries({ queryKey: ['materials'] });
  }

  async function handleCreateCategory(categoryName, codePrefix) {
    const { category } = await createCategory(categoryName, codePrefix);
    queryClient.invalidateQueries({ queryKey: ['categories'] });

    return { value: String(category.category_id), label: category.category_name };
  }

  const saveMaterialMutation = useMutation({
    mutationFn: (payload) =>
      formMode === 'edit'
        ? updateMaterial(editingMaterial.material_id, payload)
        : createMaterial(payload),
    onSuccess: () => {
      invalidateMaterialLists();
      showSuccess(formMode === 'edit' ? 'แก้ไขข้อมูลวัสดุสำเร็จ' : 'เพิ่มวัสดุสำเร็จ');
      closeForm();
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (item) => deleteMaterial(item.material_id),
    onSuccess: (_data, item) => {
      invalidateMaterialLists();
      showSuccess(`ลบ ${item.material_code} แล้ว สามารถกู้คืนได้`);
      setConfirmingDeleteId(null);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (item) => restoreMaterial(item.material_id),
    onSuccess: (_data, item) => {
      invalidateMaterialLists();
      showSuccess(`กู้คืน ${item.material_code} สำเร็จ`);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ item, quantity, remark }) =>
      withdrawMaterial(item.material_id, { quantity, remark }),
    onSuccess: (data, { item }) => {
      invalidateMaterialLists();
      showSuccess(`เบิก ${item.material_code} จำนวน ${data.withdrawal.quantity} ${item.unit_name} สำเร็จ`);
      setWithdrawingMaterial(null);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const busyMaterialId =
    (deleteMutation.isPending && deleteMutation.variables?.material_id) ||
    (restoreMutation.isPending && restoreMutation.variables?.material_id) ||
    null;

  const loading = activeListQuery.isLoading;
  const displayError = activeListQuery.error?.message;
  const optionsError = categoriesQuery.error?.message;

  function switchView(nextView) {
    setView(nextView);
    setPage(1);
    setFormMode(null);
    setConfirmingDeleteId(null);
  }

  function changeCategoryFilter(nextCategory) {
    setCategoryFilter(nextCategory);
    setPage(1);
  }

  function openCreateForm() {
    setEditingMaterial(null);
    setFormMode('create');
  }

  function openEditForm(item) {
    setEditingMaterial(item);
    setFormMode('edit');
  }

  function closeForm() {
    setFormMode(null);
    setEditingMaterial(null);
  }

  function submitForm(payload) {
    saveMaterialMutation.mutate(payload);
  }

  // ครั้งแรกเป็นเพียงเปิดโหมดยืนยัน ครั้งที่สองจึงยิง DELETE API (เหมือน EquipmentManager.jsx)
  function removeItem(item) {
    if (confirmingDeleteId !== item.material_id) {
      setConfirmingDeleteId(item.material_id);
      showSuccess('กด “ยืนยันลบ” อีกครั้งเพื่อลบแบบ Soft Delete');
      return;
    }

    deleteMutation.mutate(item);
  }

  function restoreItem(item) {
    restoreMutation.mutate(item);
  }

  function submitWithdraw({ quantity, remark }) {
    withdrawMutation.mutate({ item: withdrawingMaterial, quantity, remark });
  }

  const rangeStart =
    pagination && pagination.total > 0
      ? (pagination.page - 1) * pagination.limit + 1
      : 0;
  const rangeEnd = pagination
    ? Math.min(pagination.page * pagination.limit, pagination.total)
    : 0;

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Materials</p>
          <h2>
            {view === 'active'
              ? 'รายการวัสดุ'
              : view === 'deleted'
                ? 'วัสดุที่ถูกลบ'
                : 'ประวัติการเบิกวัสดุ'}
          </h2>
        </div>

        <div className="toolbar-actions">
          <span className="item-count">
            {pagination?.total ?? (view === 'withdrawals' ? withdrawals.length : materials.length)}{' '}
            รายการ
          </span>

          {admin && (
            <>
              <button
                className="button-secondary"
                type="button"
                onClick={() => switchView(view === 'withdrawals' ? 'active' : 'withdrawals')}
              >
                {view === 'withdrawals' ? 'รายการวัสดุ' : 'ประวัติการเบิก'}
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => switchView(view === 'deleted' ? 'active' : 'deleted')}
              >
                {view === 'deleted' ? 'รายการปัจจุบัน' : 'รายการที่ลบ'}
              </button>

              {view === 'active' && (
                <button className="button-primary" type="button" onClick={openCreateForm}>
                  + เพิ่มวัสดุ
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {view !== 'withdrawals' && (
        <div className="equipment-filters">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="ค้นหารหัสหรือชื่อวัสดุ"
          />
          <SelectWithCreate
            name="categoryFilter"
            value={categoryFilter}
            onChange={(event) => changeCategoryFilter(event.target.value)}
            options={categoryOptions}
            emptyLabel="ทุกหมวดหมู่"
            createLabel="+ เพิ่มหมวดหมู่ใหม่..."
            createFields={categoryCreateFields}
            onCreate={(fields) => handleCreateCategory(fields.name, fields.code_prefix)}
            popover
          />
        </div>
      )}

      {displayError && <p className="error-message">{displayError}</p>}

      {formMode && (
        <>
          {optionsError && <p className="error-message">{optionsError}</p>}
          <MaterialForm
            material={editingMaterial}
            categories={categories}
            submitting={saveMaterialMutation.isPending}
            onSubmit={submitForm}
            onCancel={closeForm}
            onCreateCategory={handleCreateCategory}
          />
        </>
      )}

      {withdrawingMaterial && (
        <WithdrawMaterialDialog
          material={withdrawingMaterial}
          submitting={withdrawMutation.isPending}
          onSubmit={submitWithdraw}
          onClose={() => setWithdrawingMaterial(null)}
        />
      )}

      {loading ? (
        <p className="loading-message">กำลังโหลดข้อมูล...</p>
      ) : view === 'withdrawals' ? (
        withdrawals.length === 0 ? (
          <div className="empty-state">
            <p>ยังไม่มีประวัติการเบิก</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="equipment-table">
              <thead>
                <tr>
                  <th>วัสดุ</th>
                  <th>ผู้เบิก</th>
                  <th>จำนวน</th>
                  <th>หมายเหตุ</th>
                  <th>วันที่เบิก</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((row) => (
                  <tr key={row.withdrawal_id}>
                    <td>
                      <span className="equipment-code">{row.material_code}</span>
                      <br />
                      {row.material_name}
                    </td>
                    <td>
                      {row.user_name}
                      <br />
                      {row.user_email}
                    </td>
                    <td>
                      {row.quantity} {row.unit_name}
                    </td>
                    <td>{row.remark || '-'}</td>
                    <td>{formatDateTime(row.withdrawn_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : materials.length === 0 ? (
        <div className="empty-state">
          <p>
            {search || categoryFilter
              ? 'ไม่พบวัสดุที่ตรงกับเงื่อนไข'
              : 'ยังไม่มีรายการวัสดุ'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="equipment-table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อวัสดุ</th>
                  <th>หมวดหมู่</th>
                  <th>คงเหลือ</th>
                  <th>ราคา/หน่วย</th>
                  <th>วันหมดอายุ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((item) => {
                  const busy = busyMaterialId === item.material_id;
                  const confirming = confirmingDeleteId === item.material_id;

                  return (
                    <tr key={item.material_id}>
                      <td>
                        <span className="equipment-code">{item.material_code}</span>
                      </td>
                      <td>{item.material_name}</td>
                      <td>{item.category_name}</td>
                      <td>
                        {item.quantity} {item.unit_name}
                        {item.low_stock && (
                          <>
                            {' '}
                            <span className="status-badge status-low_stock">
                              ใกล้หมด
                            </span>
                          </>
                        )}
                      </td>
                      <td>{formatPrice(item.unit_price)}</td>
                      <td>{formatDate(item.expire_date)}</td>
                      <td>
                        <div className="row-actions">
                          {view === 'active' && (
                            <button
                              className="button-restore"
                              type="button"
                              disabled={item.quantity <= 0}
                              onClick={() => setWithdrawingMaterial(item)}
                            >
                              เบิก
                            </button>
                          )}
                          {admin && view === 'active' && (
                            <>
                              <button type="button" onClick={() => openEditForm(item)} disabled={busy}>
                                แก้ไข
                              </button>
                              <button
                                className="button-danger"
                                type="button"
                                onClick={() => removeItem(item)}
                                disabled={busy}
                              >
                                {confirming ? 'ยืนยันลบ' : 'ลบ'}
                              </button>
                              {confirming && (
                                <button type="button" onClick={() => setConfirmingDeleteId(null)}>
                                  ยกเลิก
                                </button>
                              )}
                            </>
                          )}
                          {admin && view === 'deleted' && (
                            <button
                              className="button-restore"
                              type="button"
                              onClick={() => restoreItem(item)}
                              disabled={busy}
                            >
                              กู้คืน
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination-bar">
              <span className="pagination-summary">
                แสดง {rangeStart}-{rangeEnd} จาก {pagination.total} รายการ
              </span>
              <div className="pagination-controls">
                <button
                  className="button-secondary"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  ก่อนหน้า
                </button>
                <span>
                  หน้า {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
