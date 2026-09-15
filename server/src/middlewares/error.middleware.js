// จุดเดียวที่แปลง error เป็น HTTP response ป้องกันการเขียน response.status().json() กระจัดกระจายทุก route
export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500) {
    console.error(error.cause ?? error);
  }

  response.status(statusCode).json({
    message: error.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
  });
}
