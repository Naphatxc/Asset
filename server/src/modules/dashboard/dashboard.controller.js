import * as dashboardService from './dashboard.service.js';

export async function getDashboardSummary(request, response, next) {
  try {
    const currentYear = new Date().getFullYear();
    const requestedYear = Number(request.query.year);
    const year =
      Number.isInteger(requestedYear) && requestedYear > 2000
        ? requestedYear
        : currentYear;

    const summary = await dashboardService.getDashboardSummary(year);

    response.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}
