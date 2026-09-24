// รวมคำสั่งติดต่อ Dashboard summary API — สงวนให้ Admin เท่านั้น
import { request } from './http.js';

export function getDashboardSummary() {
  return request('/api/admin/dashboard/summary');
}
