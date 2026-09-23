// Component หลักของโมดูลครุภัณฑ์: TanStack Query ดูแล data fetching/cache/loading/error ทั้งหมด
// เหลือแค่ state ที่เป็น UI ล้วนๆ (view, formMode, ข้อความยืนยัน ฯลฯ) — 401 จัดการที่ main.jsx จุดเดียว
// รายการแบ่งหน้า (page/limit) + ค้นหา + กรองสถานะ ที่ backend เพื่อรองรับครุภัณฑ์หลักพันชิ้นโดยไม่โหลดมาทั้งหมด
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  applyEquipmentImageChange,
  createCategory,
  createEquipment,
  createLocation,
  deleteEquipment,
  getCategories,
  getDeletedEquipment,
  getEquipment,
  getEquipmentHistory,
  getLocations,
  getNextEquipmentCode,
  restoreEquipment,
  updateEquipment,
  updateEquipmentStatus,
} from '../../../api/equipment.js';
import EquipmentForm, {
  categoryCreateFields,
  locationCreateFields,
} from '../../../components/EquipmentForm.jsx';
import { SortSelect } from '../../../components/ListFilters.jsx';
import PaginationBar, { useClampPage } from '../../../components/PaginationBar.jsx';
import SelectWithCreate from '../../../components/SelectWithCreate.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import EquipmentHistory from './EquipmentHistory.jsx';
import EquipmentTable, { equipmentSortColumns } from './EquipmentTable.jsx';
import QrCodeDialog from '../../../components/QrCodeDialog.jsx';
import ImportEquipmentDialog from './ImportEquipmentDialog.jsx';

const PAGE_SIZE = 20;
const statusFilterOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'available', label: 'พร้อมใช้งาน' },
  { value: 'borrowed', label: 'ถูกยืม' },
  { value: 'pending_repair', label: 'รอซ่อม' },
  { value: 'repairing', label: 'กำลังซ่อม' },
  { value: 'damaged', label: 'ชำรุด' },
];

export default function EquipmentManager({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const admin = user.role === 'admin';

  // อ่านครั้งเดียวตอน mount เพื่อกู้หน้า/ตัวกรองกลับมาตอนกด "กลับหน้ารายการ" จากหน้ารายละเอียด (ดู onViewDetails
  // ด้านล่าง กับ EquipmentDetailPage.jsx) ไม่ได้ sync ต่อเนื่องสองทาง เพราะ Dashboard.jsx เป็นเจ้าของ ?tab= เอง
  const [initialParams] = useSearchParams();

  // State ควบคุมหน้าจอเท่านั้น (ไม่ใช่ข้อมูลจาก server) — ผลลัพธ์ของ action (สำเร็จ/ผิดพลาด) ไปออกเป็น
  // toast แทน (ดู ToastProvider.jsx) จึงไม่มี error/notice state ค้างอยู่ในหน้าจออีกต่อไป
  const [view, setView] = useState('active');
  const [formMode, setFormMode] = useState(null);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [historyEquipment, setHistoryEquipment] = useState(null);
  const [qrEquipment, setQrEquipment] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchInput, setSearchInput] = useState(initialParams.get('search') ?? '');
  const [search, setSearch] = useState(initialParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(initialParams.get('status') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(initialParams.get('category') ?? '');
  const [locationFilter, setLocationFilter] = useState(initialParams.get('location') ?? '');
  // key เป็น null = ลำดับเริ่มต้นของ server (เพิ่มล่าสุดก่อน) เก็บใน URL เหมือนตัวกรองอื่น กลับจากหน้ารายละเอียดแล้วไม่หาย
  const [sort, setSort] = useState(() => {
    const key = initialParams.get('sort');
    return equipmentSortColumns[key]
      ? { key, dir: initialParams.get('dir') === 'desc' ? 'desc' : 'asc' }
      : { key: null, dir: null };
  });
  const [page, setPage] = useState(() => {
    const initialPage = Number(initialParams.get('page'));
    return Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1;
  });

  // ดีเลย์ยิง API 400ms หลังพิมพ์หยุด กันยิงถี่เกินตอนค้นหาในฐานข้อมูลหลักพันแถว
  // เทียบค่ากับ ref แทนใช้ boolean "run แรก" เฉยๆ เพราะ StrictMode (dev) เรียก effect ซ้ำตอน mount
  // ถ้าใช้ boolean ตัวเดียวจะโดน flip ทิ้งจาก invoke แรก แล้ว invoke ที่สองจะหลุดไป reset page กลับเป็น 1
  // ทับค่าที่กู้มาจาก URL ตอนกด "กลับหน้ารายการ" จากหน้ารายละเอียด (เทียบค่าแทนจึง idempotent ไม่ว่าจะ
  // ถูกเรียกกี่รอบก็ตามตราบใดที่ searchInput ยังไม่เปลี่ยนจริง)
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

  const listParams = {
    page,
    limit: PAGE_SIZE,
    search,
    // ของที่จำหน่ายออกสถานะเป็น disposed ทุกชิ้น กรองสถานะในมุมมองนั้นไม่มีความหมาย (ช่องกรองถูกซ่อนด้วย)
    status: view === 'deleted' ? '' : statusFilter,
    categoryId: categoryFilter,
    locationId: locationFilter,
    sort: sort.key,
    dir: sort.dir,
  };

  const equipmentQuery = useQuery({
    queryKey: ['equipment', 'active', listParams],
    queryFn: () => getEquipment(listParams),
    enabled: view === 'active',
    placeholderData: keepPreviousData,
  });
  // เฉพาะ Admin เท่านั้นที่มีปุ่มดูรายการที่จำหน่ายออก จึงโหลดเมื่อจำเป็นจริงๆ
  const deletedEquipmentQuery = useQuery({
    queryKey: ['equipment', 'deleted', listParams],
    queryFn: () => getDeletedEquipment(listParams),
    enabled: admin && view === 'deleted',
    placeholderData: keepPreviousData,
  });
  // ใช้เป็นตัวเลือกทั้งใน dropdown กรองรายการ (ทุกคนเห็น) และใน Form เพิ่ม/แก้ไข (เฉพาะ Admin)
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
  });
  const historyQuery = useQuery({
    queryKey: ['equipment', historyEquipment?.item_id, 'history'],
    queryFn: () => getEquipmentHistory(historyEquipment.item_id),
    enabled: historyEquipment != null,
  });

  const activeListQuery = view === 'active' ? equipmentQuery : deletedEquipmentQuery;
  const equipment = activeListQuery.data?.equipment ?? [];
  const pagination = activeListQuery.data?.pagination;
  useClampPage(pagination, setPage);
  const categories = categoriesQuery.data?.categories ?? [];
  const locations = locationsQuery.data?.locations ?? [];
  const history = historyQuery.data?.history ?? [];

  // ตัวเลือกสำหรับ dropdown เปลี่ยนสถานที่แบบ inline ในตาราง และ dropdown กรองรายการ
  // (รูปแบบ label เดียวกับใน EquipmentForm)
  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: String(location.location_id),
        label: `${location.location_name}${location.room ? ` · ห้อง ${location.room}` : ''}`,
      })),
    [locations],
  );
  // ตัวเลือกสำหรับ dropdown กรองรายการตามหมวดหมู่
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.category_id),
        label: category.category_name,
      })),
    [categories],
  );

  function invalidateEquipmentLists() {
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
  }

  // เรียกจาก SelectWithCreate ในฟอร์มโดยตรง ("+ เพิ่มหมวดหมู่/สถานที่ใหม่...") คืนค่าเป็น { value, label }
  // ให้เลือกตัวที่เพิ่งสร้างในฟอร์มได้ทันที และ invalidate cache ให้ dropdown ครั้งถัดไปเห็นตัวใหม่ด้วย
  async function handleCreateCategory(categoryName, codePrefix) {
    const { category } = await createCategory(categoryName, codePrefix);
    queryClient.invalidateQueries({ queryKey: ['categories'] });

    return { value: String(category.category_id), label: category.category_name };
  }

  // เรียกตอนเลือกหมวดหมู่ในฟอร์มสร้างครุภัณฑ์ใหม่ เพื่อเดารหัสตัวถัดไปให้ (code: null ถ้าหมวดหมู่นั้นไม่มี prefix)
  async function handleFetchNextCode(categoryId) {
    const { code } = await getNextEquipmentCode(categoryId);
    return code;
  }

  async function handleCreateLocation({ name, building, room }) {
    const { location } = await createLocation({
      locationName: name,
      building: building || null,
      room: room || null,
    });
    queryClient.invalidateQueries({ queryKey: ['locations'] });

    return {
      value: String(location.location_id),
      label: `${location.location_name}${location.room ? ` · ห้อง ${location.room}` : ''}`,
    };
  }

  // Form เดียวกันเลือก Create หรือ Edit จาก formMode — รูปอัปโหลดแยกหลังบันทึกข้อมูลสำเร็จ (ตอนสร้างใหม่ต้องได้
  // item_id ก่อน) ถ้ารูปพังแต่ข้อมูลบันทึกแล้ว ไม่ถือว่าทั้งหมดล้มเหลว แจ้งให้เปิดแก้ไขแล้วใส่รูปใหม่แทน
  const saveEquipmentMutation = useMutation({
    // payload เป็น null = แก้แค่รูปอย่างเดียว (ดู EquipmentForm.jsx) ข้าม PATCH ไปเลย
    mutationFn: async ({ payload, imageChange }) => {
      let itemId = editingEquipment?.item_id;

      if (formMode !== 'edit') {
        const { equipment } = await createEquipment(payload);
        itemId = equipment.item_id;
      } else if (payload) {
        await updateEquipment(itemId, payload);
      }

      try {
        await applyEquipmentImageChange(itemId, imageChange);
        return { imageError: null };
      } catch (imageError) {
        return { imageError: imageError.message };
      }
    },
    onSuccess: ({ imageError }) => {
      invalidateEquipmentLists();
      if (imageError) {
        showError(`บันทึกข้อมูลครุภัณฑ์แล้ว แต่บันทึกรูปไม่สำเร็จ: ${imageError}`);
      } else {
        showSuccess(
          formMode === 'edit'
            ? 'แก้ไขข้อมูลครุภัณฑ์สำเร็จ'
            : 'เพิ่มครุภัณฑ์สำเร็จ',
        );
      }
      closeForm();
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  // การเปลี่ยนสถานะแยก endpoint จากการแก้ข้อมูลทั่วไป เพื่อให้ History ชัดเจน
  const statusMutation = useMutation({
    mutationFn: ({ item, status }) =>
      updateEquipmentStatus(item.item_id, status),
    onSuccess: (_data, { item }) => {
      invalidateEquipmentLists();
      showSuccess(`เปลี่ยนสถานะ ${item.equipment_code} สำเร็จ`);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  // เปลี่ยนสถานที่แบบ inline ในตาราง ใช้ endpoint แก้ไขทั่วไปตัวเดียวกับฟอร์ม (รองรับ location_id อยู่แล้ว)
  const locationMutation = useMutation({
    mutationFn: ({ item, locationId }) =>
      updateEquipment(item.item_id, { location_id: locationId }),
    onSuccess: (_data, { item }) => {
      invalidateEquipmentLists();
      showSuccess(`เปลี่ยนสถานที่ ${item.equipment_code} สำเร็จ`);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (item) => deleteEquipment(item.item_id),
    onSuccess: (_data, item) => {
      invalidateEquipmentLists();
      showSuccess(`จำหน่ายออก ${item.equipment_code} แล้ว สามารถกู้คืนได้`);
      setConfirmingDeleteId(null);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  // Restore ทำให้ deleted_at กลับเป็น null แล้วให้ทั้งสอง query invalidate ไปโหลดใหม่เอง
  const restoreMutation = useMutation({
    mutationFn: (item) => restoreEquipment(item.item_id),
    onSuccess: (_data, item) => {
      invalidateEquipmentLists();
      showSuccess(`กู้คืน ${item.equipment_code} สำเร็จ`);
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  // ปุ่มของแถวไหนกำลังถูก mutate อยู่ ใช้ disable เฉพาะแถวนั้นระหว่างรอผล (item_id ไม่มีทางเป็น 0)
  const busyItemId =
    (statusMutation.isPending && statusMutation.variables?.item?.item_id) ||
    (locationMutation.isPending && locationMutation.variables?.item?.item_id) ||
    (deleteMutation.isPending && deleteMutation.variables?.item_id) ||
    (restoreMutation.isPending && restoreMutation.variables?.item_id) ||
    null;

  const loading = activeListQuery.isLoading;
  // แสดงเฉพาะตอนโหลดรายการล้มเหลวจริงๆ (สถานะหน้าจอค้าง ไม่ใช่ผลลัพธ์ของ action ที่ไปออกเป็น toast แล้ว)
  const displayError = activeListQuery.error?.message;
  const optionsError = categoriesQuery.error?.message || locationsQuery.error?.message;

  // สลับระหว่างข้อมูลที่ใช้งานอยู่กับข้อมูลที่ถูก Soft Delete
  function switchView(nextView) {
    setView(nextView);
    setPage(1);
    setFormMode(null);
    setHistoryEquipment(null);
    setConfirmingDeleteId(null);
  }

  function changeSort(nextSort) {
    setSort(nextSort);
    setPage(1);
  }

  function changeStatusFilter(nextStatus) {
    setStatusFilter(nextStatus);
    setPage(1);
  }

  function changeCategoryFilter(nextCategory) {
    setCategoryFilter(nextCategory);
    setPage(1);
  }

  function changeLocationFilter(nextLocation) {
    setLocationFilter(nextLocation);
    setPage(1);
  }

  // ให้หน้ารายละเอียดครุภัณฑ์รู้ว่าตอนกด "กลับหน้ารายการ" ต้องพากลับมาหน้า/ตัวกรองไหน (ดู initialParams ด้านบน)
  function buildReturnUrl() {
    const params = new URLSearchParams({ tab: 'equipment' });
    if (page > 1) params.set('page', String(page));
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (locationFilter) params.set('location', locationFilter);
    if (sort.key) {
      params.set('sort', sort.key);
      params.set('dir', sort.dir);
    }

    return `/?${params.toString()}`;
  }

  function openCreateForm() {
    setEditingEquipment(null);
    setHistoryEquipment(null);
    setFormMode('create');
  }

  function openEditForm(item) {
    setEditingEquipment(item);
    setHistoryEquipment(null);
    setFormMode('edit');
  }

  function closeForm() {
    setFormMode(null);
    setEditingEquipment(null);
  }

  function submitForm(payload, imageChange) {
    saveEquipmentMutation.mutate({ payload, imageChange });
  }

  function changeStatus(item, status) {
    statusMutation.mutate({ item, status });
  }

  function changeLocation(item, locationId) {
    locationMutation.mutate({ item, locationId: locationId || null });
  }

  // ครั้งแรกเป็นเพียงเปิดโหมดยืนยัน ครั้งที่สองจึงยิง DELETE API
  function removeItem(item) {
    if (confirmingDeleteId !== item.item_id) {
      setConfirmingDeleteId(item.item_id);
      showSuccess('กด “ยืนยันจำหน่ายออก” อีกครั้งเพื่อจำหน่ายออก');
      return;
    }

    deleteMutation.mutate(item);
  }

  function restoreItem(item) {
    restoreMutation.mutate(item);
  }

  // History โหลดเมื่อผู้ใช้ขอดูเท่านั้น (enabled: historyEquipment != null) เพื่อลด request ตอนเปิดหน้า
  function openHistory(item) {
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
              : 'ครุภัณฑ์ที่จำหน่ายออก'}
          </h2>
        </div>

        <div className="toolbar-actions">
          <span className="item-count">
            {pagination?.total ?? equipment.length} รายการ
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
                  ? 'รายการที่จำหน่ายออก'
                  : 'รายการปัจจุบัน'}
              </button>

              {view === 'active' && (
                <>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => setImporting(true)}
                  >
                    นำเข้าจากไฟล์
                  </button>
                  <button
                    className="button-primary"
                    type="button"
                    onClick={openCreateForm}
                  >
                    + เพิ่มครุภัณฑ์
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="equipment-filters">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="ค้นหารหัสหรือชื่อครุภัณฑ์"
        />
        {view === 'active' && (
          <select
            value={statusFilter}
            onChange={(event) => changeStatusFilter(event.target.value)}
          >
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
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
        <SelectWithCreate
          name="locationFilter"
          value={locationFilter}
          onChange={(event) => changeLocationFilter(event.target.value)}
          options={locationOptions}
          emptyLabel="ทุกสถานที่"
          createLabel="+ เพิ่มสถานที่ใหม่..."
          createFields={locationCreateFields}
          onCreate={(fields) => handleCreateLocation(fields)}
          popover
        />
        <SortSelect
          sortColumns={equipmentSortColumns}
          sort={sort}
          onSortChange={changeSort}
          defaultLabel={view === 'deleted' ? 'จำหน่ายล่าสุดก่อน' : 'เพิ่มล่าสุดก่อน'}
        />
      </div>

      {displayError && <p className="error-message">{displayError}</p>}

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
            onCreateCategory={handleCreateCategory}
            onCreateLocation={handleCreateLocation}
            onFetchNextCode={handleFetchNextCode}
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

      {importing && <ImportEquipmentDialog onClose={() => setImporting(false)} />}

      {loading ? (
        <p className="loading-message">กำลังโหลดครุภัณฑ์...</p>
      ) : equipment.length === 0 ? (
        <div className="empty-state">
          <p>
            {search || statusFilter || categoryFilter || locationFilter
              ? 'ไม่พบครุภัณฑ์ที่ตรงกับเงื่อนไข'
              : 'ยังไม่มีรายการครุภัณฑ์'}
          </p>
        </div>
      ) : (
        <>
          <EquipmentTable
            equipment={equipment}
            admin={admin}
            mode={view}
            busyItemId={busyItemId}
            confirmingDeleteId={confirmingDeleteId}
            onViewDetails={(item) =>
              navigate(
                `/equipment/${encodeURIComponent(item.equipment_code)}`,
                { state: { returnTo: buildReturnUrl() } },
              )
            }
            onShowQr={setQrEquipment}
            onEdit={openEditForm}
            onStatusChange={changeStatus}
            locationOptions={locationOptions}
            onLocationChange={changeLocation}
            onHistory={openHistory}
            onDelete={removeItem}
            onCancelDelete={() => setConfirmingDeleteId(null)}
            onRestore={restoreItem}
            sort={sort}
            onSortChange={changeSort}
          />

          <PaginationBar pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
