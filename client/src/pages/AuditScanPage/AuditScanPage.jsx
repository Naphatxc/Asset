// หน้าเดินตรวจนับบนมือถือ (/audit/:roundId) — admin เลือกห้องที่ยืนอยู่ สแกน QR แล้วกดผลทีละชิ้น
// กดผลแล้วมีผลกับข้อมูลจริงทันที (ย้ายห้อง/เปิดใบแจ้งซ่อม) ไม่มีขั้นยืนยันซ้ำตอนท้าย ถ้ากดผิดแก้จากการ์ดเดิมได้เลย
// รายการของทั้งรอบโหลดมาครั้งเดียว (ไม่กี่ร้อยแถว) แล้วค้น/กรองตามห้องฝั่ง client สแกนแล้วจึงเจอการ์ดทันทีไม่ต้องรอ network
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { checkAuditItem, getAuditRound, resetAuditItem } from '../../api/audit.js';
import { getEquipmentByCode, getLocations } from '../../api/equipment.js';
import QrScannerView from '../../components/QrScannerView.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import {
  classifyRecord,
  equipmentStatusLabels,
  formatDateTime,
  locationLabel,
  outcomeLabels,
} from '../../utils/audit.js';
import { parseEquipmentCode } from '../../utils/equipment-qr.js';

const NO_ROOM = '';
const LIST_PAGE_SIZE = 30;
// กล้องอ่าน QR เดิมซ้ำได้หลายครั้งต่อวินาทีตอนยังเล็งค้างอยู่ ต้องเว้นช่วงก่อนนับเป็นการสแกนใหม่
const RESCAN_COOLDOWN_MS = 2500;

// จำห้องที่เลือกไว้ต่อรอบ เผื่อจอดับ/รีเฟรชระหว่างเดินตรวจจะได้ไม่ต้องเลือกใหม่ (ไม่สำคัญถ้าอ่านไม่ได้)
function readSavedRoom(roundId) {
  try {
    return localStorage.getItem(`audit-room-${roundId}`) ?? NO_ROOM;
  } catch {
    return NO_ROOM;
  }
}

function saveRoom(roundId, roomId) {
  try {
    localStorage.setItem(`audit-room-${roundId}`, roomId);
  } catch {
    // ไม่มีผลกับการทำงาน แค่ครั้งหน้าต้องเลือกห้องเอง
  }
}

// ครุภัณฑ์ที่เพิ่มเข้าระบบหลังเปิดรอบยังไม่มีแถวในรอบ แปลงข้อมูลจาก API ครุภัณฑ์ให้หน้าตาเหมือนแถวของรอบ
function toOutsideRecord(equipment) {
  return {
    item_id: equipment.item_id,
    equipment_code: equipment.equipment_code,
    equipment_name: equipment.equipment_name,
    category_name: equipment.category_name,
    status: equipment.status,
    deleted: false,
    current_location_id: equipment.location_id,
    expected_location_id: null,
    result: null,
    note: null,
    found_location_id: null,
    location_moved: false,
    moved_from_location_id: null,
    repair_id: null,
    repair_status: null,
    checked_by_name: null,
    checked_at: null,
    outside: true,
  };
}

function ProgressBar({ done, total }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="audit-progress">
      <div className="audit-progress-track">
        <div className="audit-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <span>
        {done}/{total}
      </span>
    </div>
  );
}

export default function AuditScanPage({ user }) {
  const { roundId: roundIdParam } = useParams();
  const roundId = Number(roundIdParam);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const [roomId, setRoomId] = useState(() => readSavedRoom(roundId));
  const [scanning, setScanning] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [outsideRecord, setOutsideRecord] = useState(null);
  const [note, setNote] = useState('');
  const [moveLocation, setMoveLocation] = useState(true);
  const [lookupMessage, setLookupMessage] = useState('');
  const [search, setSearch] = useState('');
  const [listLimit, setListLimit] = useState(LIST_PAGE_SIZE);
  const lastScanRef = useRef({ code: null, at: 0 });
  // ใช้เช็คตอน request ก่อนหน้าตอบกลับว่าการ์ดยังเป็นชิ้นเดิมอยู่ไหม เพราะสแกนเร็วๆ การ์ดอาจเปลี่ยนไปแล้ว
  const selectedItemIdRef = useRef(null);
  selectedItemIdRef.current = selectedItemId;

  const roundQuery = useQuery({
    queryKey: ['audit', roundId],
    queryFn: () => getAuditRound(roundId),
    enabled: user.role === 'admin' && Number.isInteger(roundId),
  });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: getLocations });

  const round = roundQuery.data?.round ?? null;
  const records = useMemo(() => roundQuery.data?.records ?? [], [roundQuery.data]);
  const locations = useMemo(() => locationsQuery.data?.locations ?? [], [locationsQuery.data]);
  const roundOpen = round?.status === 'open';

  const locationsById = useMemo(
    () => new Map(locations.map((location) => [location.location_id, location])),
    [locations],
  );
  const recordsByCode = useMemo(
    () => new Map(records.map((record) => [record.equipment_code.toUpperCase(), record])),
    [records],
  );

  const selectedRecord =
    records.find((record) => record.item_id === selectedItemId) ?? outsideRecord;
  // ห้องที่จำไว้ใน localStorage อาจไม่มีแล้ว ถือว่าไม่ได้เลือก ไม่งั้นกดผลจะพยายามย้ายไปห้องที่ไม่มีอยู่
  const roomNumber =
    roomId !== NO_ROOM && locationsById.has(Number(roomId)) ? Number(roomId) : null;
  const checkedCount = records.filter((record) => record.result).length;

  // ห้องนี้ควรมีอะไรบ้าง นับจากห้อง ณ ตอนเปิดรอบ ไม่ใช่ห้องปัจจุบัน ตัวเลขจะได้ไม่ขยับตอนย้ายห้องระหว่างตรวจ
  const roomRecords = useMemo(
    () => records.filter((record) => record.expected_location_id === roomNumber),
    [records, roomNumber],
  );
  const roomCheckedCount = roomRecords.filter((record) => record.result).length;
  const foundHereFromElsewhere = useMemo(
    () =>
      roomNumber === null
        ? []
        : records.filter(
            (record) =>
              record.found_location_id === roomNumber &&
              record.expected_location_id !== roomNumber,
          ),
    [records, roomNumber],
  );

  const listRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    // พิมพ์ค้นหาแล้วค้นทั้งรอบ ไม่ใช่แค่ห้องนี้ เผื่อป้าย QR หายแล้วของอยู่ผิดห้อง
    const matched = keyword
      ? records.filter(
          (record) =>
            record.equipment_code.toLowerCase().includes(keyword) ||
            record.equipment_name.toLowerCase().includes(keyword),
        )
      : roomRecords;

    // ยังไม่ตรวจขึ้นก่อน เป็นรายการที่ต้องเดินหาต่อ
    return [...matched].sort((a, b) => Number(Boolean(a.result)) - Number(Boolean(b.result)));
  }, [records, roomRecords, search]);

  function changeRoom(event) {
    setRoomId(event.target.value);
    saveRoom(roundId, event.target.value);
    setListLimit(LIST_PAGE_SIZE);
  }

  function selectRecord(record) {
    setSelectedItemId(record.item_id);
    setOutsideRecord(record.outside ? record : null);
    setNote(record.note ?? '');
    // ของที่ถูกยืมไปแล้วเจอในห้องไหน มักเป็นห้องของผู้ยืม ไม่ใช่ห้องประจำ จึงไม่ติ๊กย้ายห้องไว้ให้
    setMoveLocation(record.status !== 'borrowed');
    setLookupMessage('');
  }

  function closeCard() {
    setSelectedItemId(null);
    setOutsideRecord(null);
  }

  async function openByCode(code) {
    const record = recordsByCode.get(code);
    if (record) {
      selectRecord(record);
      return;
    }

    try {
      const { equipment } = await getEquipmentByCode(code);
      selectRecord(toOutsideRecord(equipment));
    } catch (lookupError) {
      setLookupMessage(
        lookupError.status === 404
          ? `ไม่พบครุภัณฑ์รหัส ${code} ในระบบ`
          : lookupError.message,
      );
    }
  }

  function handleScan(text) {
    const code = parseEquipmentCode(text);
    const now = Date.now();

    if (lastScanRef.current.code === (code ?? text) && now - lastScanRef.current.at < RESCAN_COOLDOWN_MS) {
      return;
    }
    lastScanRef.current = { code: code ?? text, at: now };

    if (!code) {
      setLookupMessage('QR นี้ไม่ใช่ป้ายครุภัณฑ์ของระบบ');
      return;
    }
    if (selectedRecord?.equipment_code.toUpperCase() === code) return;

    // สั่นเบาๆ ให้รู้ว่าอ่านติดแล้วโดยไม่ต้องมองจอ (มีผลเฉพาะ Android, iPhone ไม่รองรับ)
    navigator.vibrate?.(60);
    openByCode(code);
  }

  function submitSearch(event) {
    event.preventDefault();
    const code = search.trim().toUpperCase();
    if (code) openByCode(code);
  }

  function updateCachedRecord(record) {
    queryClient.setQueryData(['audit', roundId], (current) => {
      if (!current) return current;

      const exists = current.records.some((item) => item.item_id === record.item_id);
      return {
        ...current,
        records: exists
          ? current.records.map((item) => (item.item_id === record.item_id ? record : item))
          : [...current.records, record],
      };
    });
    queryClient.invalidateQueries({ queryKey: ['audit-rounds'] });
    // ย้ายห้อง/เปิดใบซ่อมกระทบหน้าครุภัณฑ์และแจ้งซ่อมด้วย
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    queryClient.invalidateQueries({ queryKey: ['repairs'] });
    // แถวนี้อยู่ใน cache แล้ว เลิกใช้ตัวชั่วคราว (เฉพาะถ้าการ์ดยังเป็นชิ้นนี้ ไม่ใช่ชิ้นใหม่ที่เพิ่งสแกน)
    setOutsideRecord((current) => (current?.item_id === record.item_id ? null : current));
  }

  const checkMutation = useMutation({
    mutationFn: ({ record, result }) =>
      checkAuditItem(roundId, record.item_id, {
        result,
        note,
        locationId: roomNumber,
        moveLocation: roomNumber !== null && moveLocation,
      }),
    onSuccess: (data, { result }) => {
      updateCachedRecord(data.record);
      if (selectedItemIdRef.current === data.record.item_id) setNote(data.record.note ?? '');
      showSuccess(
        [`${data.record.equipment_code} · ${outcomeLabels[result]}`, ...data.notices].join(' — '),
      );
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const resetMutation = useMutation({
    mutationFn: (record) => resetAuditItem(roundId, record.item_id),
    onSuccess: (data) => {
      updateCachedRecord(data.record);
      if (selectedItemIdRef.current === data.record.item_id) setNote('');
      showSuccess(
        [`${data.record.equipment_code} · ล้างผลแล้ว`, ...data.notices].join(' — '),
      );
    },
    onError: (mutationError) => showError(mutationError.message),
  });

  const busy = checkMutation.isPending || resetMutation.isPending;

  if (user.role !== 'admin') {
    return (
      <main className="app-shell">
        <section className="welcome-card centered-state">
          <p className="eyebrow">403</p>
          <h1>ไม่มีสิทธิ์ใช้งาน</h1>
          <p>การตรวจนับครุภัณฑ์ใช้ได้เฉพาะผู้ดูแลระบบ</p>
          <Link className="button-link button-primary" to="/">
            กลับหน้าหลัก
          </Link>
        </section>
      </main>
    );
  }

  if (roundQuery.isLoading) {
    return (
      <main className="app-shell">
        <p className="loading-message">กำลังโหลดรอบตรวจนับ...</p>
      </main>
    );
  }

  if (!round) {
    return (
      <main className="app-shell">
        <section className="welcome-card centered-state">
          <p className="eyebrow">Error</p>
          <h1>โหลดรอบตรวจนับไม่สำเร็จ</h1>
          <p>{roundQuery.error?.message || 'กรุณาลองใหม่อีกครั้ง'}</p>
          <Link className="button-link button-primary" to="/?tab=audit">
            กลับหน้าตรวจนับ
          </Link>
        </section>
      </main>
    );
  }

  const selectedOutcome = selectedRecord ? classifyRecord(selectedRecord, !roundOpen) : null;
  const roomMismatch =
    selectedRecord && roomNumber !== null && selectedRecord.current_location_id !== roomNumber;

  return (
    <main className="audit-scan-shell">
      <header className="audit-scan-header">
        <Link to="/?tab=audit" className="audit-back-link">
          ← กลับ
        </Link>
        <p className="eyebrow">ตรวจนับครุภัณฑ์</p>
        <h1>{round.title}</h1>
        <ProgressBar done={checkedCount} total={records.length} />
        {!roundOpen && (
          <p className="audit-closed-note">รอบนี้ปิดแล้ว ดูผลได้อย่างเดียว</p>
        )}
      </header>

      <section className="audit-panel">
        <label className="audit-room-label">
          ห้องที่กำลังตรวจ
          <select value={roomNumber === null ? NO_ROOM : roomId} onChange={changeRoom}>
            <option value={NO_ROOM}>ไม่เลือกห้อง (ไม่ย้ายห้องให้)</option>
            {locations.map((location) => (
              <option key={location.location_id} value={String(location.location_id)}>
                {locationLabel(location)}
              </option>
            ))}
          </select>
        </label>
        <div className="audit-room-progress">
          <span>
            {roomNumber === null ? 'ชิ้นที่ยังไม่ระบุห้อง' : 'ชิ้นที่ควรอยู่ห้องนี้'} ตรวจแล้ว
          </span>
          <ProgressBar done={roomCheckedCount} total={roomRecords.length} />
        </div>
      </section>

      {roundOpen && (
        <section className="audit-panel">
          {scanning ? (
            <>
              <QrScannerView onScan={handleScan} />
              <button
                type="button"
                className="button-secondary audit-wide-button"
                onClick={() => setScanning(false)}
              >
                ปิดกล้อง
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button-primary audit-scan-button"
              onClick={() => {
                setLookupMessage('');
                setScanning(true);
              }}
            >
              เปิดกล้องสแกน QR
            </button>
          )}
        </section>
      )}

      {lookupMessage && <p className="error-message audit-lookup-message">{lookupMessage}</p>}

      {selectedRecord && (
        <section className={`audit-panel audit-item-card audit-outcome-${selectedOutcome}`}>
          <div className="audit-item-heading">
            <div>
              <span className="equipment-code">{selectedRecord.equipment_code}</span>
              <h2>{selectedRecord.equipment_name}</h2>
              <p className="audit-item-meta">
                {selectedRecord.category_name}
                {' · '}
                <span className={`status-badge status-${selectedRecord.status}`}>
                  {equipmentStatusLabels[selectedRecord.status] ?? selectedRecord.status}
                </span>
              </p>
            </div>
            <button type="button" className="button-secondary" onClick={closeCard}>
              ปิด
            </button>
          </div>

          <p className="audit-item-meta">
            ห้องในระบบ: {locationLabel(locationsById.get(selectedRecord.current_location_id))}
          </p>

          {selectedRecord.outside && (
            <p className="audit-notice">
              ชิ้นนี้เพิ่มเข้าระบบหลังเปิดรอบ จึงไม่อยู่ในรายการตั้งต้น บันทึกผลได้ตามปกติ
            </p>
          )}

          {selectedRecord.result && (
            <p className="audit-notice audit-notice-done">
              ตรวจแล้ว: <strong>{outcomeLabels[selectedRecord.result]}</strong>
              {' · '}
              {selectedRecord.checked_by_name} · {formatDateTime(selectedRecord.checked_at)}
              {selectedRecord.location_moved && (
                <>
                  <br />
                  ย้ายมาจาก {locationLabel(locationsById.get(selectedRecord.moved_from_location_id))}
                </>
              )}
              {selectedRecord.repair_id && (
                <>
                  <br />
                  เปิดใบแจ้งซ่อมแล้ว (#{selectedRecord.repair_id})
                </>
              )}
            </p>
          )}

          {selectedRecord.deleted ? (
            <p className="error-message">ครุภัณฑ์ชิ้นนี้ถูกลบออกจากระบบแล้ว</p>
          ) : roundOpen ? (
            <>
              {roomMismatch && (
                <label className="audit-move-toggle">
                  <input
                    type="checkbox"
                    checked={moveLocation}
                    onChange={(event) => setMoveLocation(event.target.checked)}
                  />
                  <span>
                    {selectedRecord.current_location_id === null
                      ? 'ยังไม่ได้ระบุห้องในระบบ — '
                      : 'อยู่ผิดห้อง — '}
                    ตั้งห้องเป็น <strong>{locationLabel(locationsById.get(roomNumber))}</strong>
                  </span>
                </label>
              )}

              <textarea
                className="audit-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="หมายเหตุ (ถ้าชำรุด ข้อความนี้จะเป็นอาการในใบแจ้งซ่อม)"
              />

              <div className="audit-result-buttons">
                <button
                  type="button"
                  className="audit-result-normal"
                  disabled={busy}
                  onClick={() => checkMutation.mutate({ record: selectedRecord, result: 'normal' })}
                >
                  ✓ ปกติ
                </button>
                <button
                  type="button"
                  className="audit-result-damaged"
                  disabled={busy}
                  onClick={() => checkMutation.mutate({ record: selectedRecord, result: 'damaged' })}
                >
                  ชำรุด
                </button>
              </div>

              {selectedRecord.result && (
                <button
                  type="button"
                  className="button-secondary audit-wide-button"
                  disabled={busy}
                  onClick={() => resetMutation.mutate(selectedRecord)}
                >
                  ล้างผล (กลับเป็นยังไม่ตรวจ)
                </button>
              )}
            </>
          ) : null}
        </section>
      )}

      <section className="audit-panel">
        <form className="audit-search" onSubmit={submitSearch}>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setListLimit(LIST_PAGE_SIZE);
            }}
            placeholder="ค้นหา หรือพิมพ์รหัสแล้วกดเปิด (กรณีป้าย QR หาย)"
          />
          <button type="submit" className="button-secondary">
            เปิด
          </button>
        </form>

        {listRecords.length === 0 ? (
          <p className="audit-empty">ไม่มีครุภัณฑ์ในรายการนี้</p>
        ) : (
          <ul className="audit-list">
            {listRecords.slice(0, listLimit).map((record) => {
              const outcome = classifyRecord(record, !roundOpen);

              return (
                <li key={record.item_id}>
                  <button type="button" onClick={() => selectRecord(record)}>
                    <span>
                      <span className="equipment-code">{record.equipment_code}</span>
                      <span className="audit-list-name">{record.equipment_name}</span>
                    </span>
                    <span className={`audit-outcome-badge audit-outcome-${outcome}`}>
                      {outcomeLabels[outcome]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {listRecords.length > listLimit && (
          <button
            type="button"
            className="button-secondary audit-wide-button"
            onClick={() => setListLimit((current) => current + LIST_PAGE_SIZE)}
          >
            แสดงเพิ่ม ({listRecords.length - listLimit} รายการ)
          </button>
        )}

        {foundHereFromElsewhere.length > 0 && (
          <>
            <h3 className="audit-list-heading">พบในห้องนี้ (ย้ายมาจากห้องอื่น)</h3>
            <ul className="audit-list">
              {foundHereFromElsewhere.map((record) => (
                <li key={record.item_id}>
                  <button type="button" onClick={() => selectRecord(record)}>
                    <span>
                      <span className="equipment-code">{record.equipment_code}</span>
                      <span className="audit-list-name">{record.equipment_name}</span>
                    </span>
                    <span className={`audit-outcome-badge audit-outcome-${record.result}`}>
                      {outcomeLabels[record.result]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
