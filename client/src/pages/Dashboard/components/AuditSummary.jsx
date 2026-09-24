// สรุปผลของรอบตรวจนับหนึ่งรอบ: ยอดแต่ละผล + ตารางกรองตามผล + export CSV ไว้เปิดใน Excel
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { getAuditRound } from '../../../api/audit.js';
import { getLocations } from '../../../api/equipment.js';
import { SortableTh, SortSelect, sortRows } from '../../../components/ListFilters.jsx';
import {
  classifyRecord,
  downloadAuditCsv,
  equipmentStatusLabels,
  formatDateTime,
  locationLabel,
  outcomeLabels,
} from '../../../utils/audit.js';

const PAGE_SIZE = 50;

// "moved" ไม่ใช่ผลตรวจ แต่เป็นตัวกรองเสริมที่ admin อยากไล่ดูหลังตรวจเสร็จ
const filterOrder = [
  'all',
  'normal',
  'damaged',
  'missing',
  'unchecked',
  'borrowed',
  'in_repair',
  'deleted',
  'moved',
];
const filterLabels = { all: 'ทั้งหมด', moved: 'ย้ายห้อง', ...outcomeLabels };

export default function AuditSummary({ roundId }) {
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  // key เป็น null = ลำดับที่ server ส่งมา
  const [sort, setSort] = useState({ key: null, dir: null });

  const roundQuery = useQuery({
    queryKey: ['audit', roundId],
    queryFn: () => getAuditRound(roundId),
  });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: getLocations });

  const round = roundQuery.data?.round ?? null;
  const locationsById = useMemo(
    () =>
      new Map(
        (locationsQuery.data?.locations ?? []).map((location) => [
          location.location_id,
          location,
        ]),
      ),
    [locationsQuery.data],
  );

  const classified = useMemo(() => {
    const records = roundQuery.data?.records ?? [];
    const closed = roundQuery.data?.round.status === 'closed';
    return records.map((record) => ({ record, outcome: classifyRecord(record, closed) }));
  }, [roundQuery.data]);

  const counts = useMemo(() => {
    const result = { all: classified.length, moved: 0 };
    for (const { record, outcome } of classified) {
      result[outcome] = (result[outcome] ?? 0) + 1;
      if (record.location_moved) result.moved += 1;
    }
    return result;
  }, [classified]);

  // ห้องเรียงตามชื่อที่แสดง ไล่ตรวจทีละห้องได้ ผลตรวจ/สถานะมีตัวกรอง (chip) อยู่แล้วไม่ต้องเรียง
  const sortColumns = {
    code: {
      label: 'รหัสครุภัณฑ์',
      type: 'text',
      get: ({ record }) => record.equipment_code,
      dirLabels: { asc: 'A→Z', desc: 'Z→A' },
    },
    room: {
      label: 'ห้อง',
      type: 'text',
      get: ({ record }) => locationLabel(locationsById.get(record.current_location_id)),
    },
    checked_at: { label: 'เวลาตรวจ', type: 'date', get: ({ record }) => record.checked_at },
  };
  const sortProps = {
    sortColumns,
    sort,
    onSortChange: (nextSort) => {
      setSort(nextSort);
      setLimit(PAGE_SIZE);
    },
  };

  const filtered = classified.filter(({ record, outcome }) =>
    filter === 'all' ? true : filter === 'moved' ? record.location_moved : outcome === filter,
  );
  const visible = sortRows(filtered, sortColumns, sort);

  if (roundQuery.isLoading) {
    return <p className="loading-message">กำลังโหลดผลการตรวจ...</p>;
  }
  if (!round) {
    return <p className="error-message">{roundQuery.error?.message ?? 'โหลดผลการตรวจไม่สำเร็จ'}</p>;
  }

  return (
    <div className="audit-summary">
      <div className="form-heading">
        <div>
          <p className="section-kicker">Summary</p>
          <h3>ผลการตรวจ: {round.title}</h3>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={() =>
            downloadAuditCsv(
              round,
              classified.map(({ record }) => record),
              locationsById,
            )
          }
        >
          ดาวน์โหลด Excel (CSV)
        </button>
      </div>

      <div className="audit-filter-chips">
        {filterOrder
          .filter((key) => key === 'all' || counts[key] > 0)
          .map((key) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'audit-chip active' : 'audit-chip'}
              onClick={() => {
                setFilter(key);
                setLimit(PAGE_SIZE);
              }}
            >
              {filterLabels[key]} <strong>{counts[key]}</strong>
            </button>
          ))}
      </div>

      <div className="equipment-filters sort-only-cards">
        <SortSelect {...sortProps} defaultLabel="ลำดับเดิม" />
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>ไม่มีรายการในกลุ่มนี้</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="equipment-table responsive-table">
            <thead>
              <tr>
                <SortableTh sortKey="code" {...sortProps}>ครุภัณฑ์</SortableTh>
                <th>ผลตรวจ</th>
                <SortableTh sortKey="room" {...sortProps}>ห้อง</SortableTh>
                <th>สถานะปัจจุบัน</th>
                <SortableTh sortKey="checked_at" {...sortProps}>ผู้ตรวจ</SortableTh>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, limit).map(({ record, outcome }) => (
                <tr key={record.item_id}>
                  <td data-label="ครุภัณฑ์">
                    <span className="equipment-code">{record.equipment_code}</span>
                    <br />
                    {record.equipment_name}
                  </td>
                  <td data-label="ผลตรวจ">
                    <span className={`audit-outcome-badge audit-outcome-${outcome}`}>
                      {outcomeLabels[outcome]}
                    </span>
                  </td>
                  <td data-label="ห้อง">
                    {locationLabel(locationsById.get(record.current_location_id))}
                    {record.location_moved && (
                      <>
                        <br />
                        <small>
                          ย้ายมาจาก {locationLabel(locationsById.get(record.moved_from_location_id))}
                        </small>
                      </>
                    )}
                  </td>
                  <td data-label="สถานะปัจจุบัน">
                    <span className={`status-badge status-${record.status}`}>
                      {equipmentStatusLabels[record.status] ?? record.status}
                    </span>
                  </td>
                  <td data-label="ผู้ตรวจ">
                    {record.checked_by_name ?? '-'}
                    {record.checked_at && (
                      <>
                        <br />
                        <small>{formatDateTime(record.checked_at)}</small>
                      </>
                    )}
                  </td>
                  <td data-label="หมายเหตุ">{record.note ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible.length > limit && (
        <button
          type="button"
          className="button-secondary audit-wide-button"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
        >
          แสดงเพิ่ม ({visible.length - limit} รายการ)
        </button>
      )}
    </div>
  );
}
