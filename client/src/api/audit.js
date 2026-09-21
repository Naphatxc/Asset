// รวมคำสั่งติดต่อ Audit API (ตรวจนับครุภัณฑ์ประจำปี) — สงวนให้ Admin เท่านั้น
import { request } from './http.js';

export function getAuditRounds() {
  return request('/api/admin/audits');
}

export function getAuditRound(roundId) {
  return request(`/api/admin/audits/${roundId}`);
}

export function openAuditRound(title) {
  return request('/api/admin/audits', { method: 'POST', body: { title } });
}

export function closeAuditRound(roundId) {
  return request(`/api/admin/audits/${roundId}/close`, { method: 'PATCH' });
}

// moveLocation = true ให้ย้ายห้องของครุภัณฑ์เป็น locationId ทันที (ห้องที่กำลังเดินตรวจอยู่)
export function checkAuditItem(roundId, itemId, { result, note, locationId, moveLocation }) {
  return request(`/api/admin/audits/${roundId}/records/${itemId}`, {
    method: 'PUT',
    body: {
      result,
      note,
      location_id: locationId,
      move_location: moveLocation,
    },
  });
}

export function resetAuditItem(roundId, itemId) {
  return request(`/api/admin/audits/${roundId}/records/${itemId}`, {
    method: 'DELETE',
  });
}
