import * as healthService from './health.service.js';

export function getHealth(_request, response) {
  response.status(200).json({
    status: 'ok',
    service: 'asset-management-api',
  });
}

// Endpoint นี้ตอบ { status: 'error', message } ตอน fail ต่างจาก endpoint อื่นที่ตอบแค่ { message }
// จึงจัดการ error เฉพาะจุดแทนการส่งต่อ error middleware กลาง เพื่อคง response เดิมทุกประการ
export async function getDatabaseStatus(_request, response) {
  try {
    const database = await healthService.checkDatabase();

    response.status(200).json({ status: 'ok', database });
  } catch {
    response.status(500).json({
      status: 'error',
      message: 'Database connection failed',
    });
  }
}
