import * as dashboardService from './dashboard.service.js';

export async function getDashboardSummary(request, response, next) {
  try {
    const summary = await dashboardService.getDashboardSummary();

    response.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}
