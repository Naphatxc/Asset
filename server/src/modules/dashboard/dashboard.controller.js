import * as dashboardService from './dashboard.service.js';

export async function getDashboardSummary(request, response, next) {
  try {
    // ไม่ส่ง year มา หรือส่งมาไม่ถูกต้อง = ให้สรุปข้อมูลรวมทุกปี (year เป็น null)
    const requestedYear = Number(request.query.year);
    const year =
      Number.isInteger(requestedYear) && requestedYear > 2000
        ? requestedYear
        : null;

    const summary = await dashboardService.getDashboardSummary(year);

    response.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}
