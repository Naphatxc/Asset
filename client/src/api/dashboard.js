// รวมคำสั่งติดต่อ Dashboard summary API — สงวนให้ Admin เท่านั้น
import { request } from './http.js';

export function getDashboardSummary(year) {
  const query = year ? `?year=${encodeURIComponent(year)}` : '';
  return request(`/api/admin/dashboard/summary${query}`);
}
