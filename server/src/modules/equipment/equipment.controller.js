import * as equipmentImportService from './equipment-import.service.js';
import * as equipmentService from './equipment.service.js';
import { allowedStatuses } from './equipment.validator.js';
import { equipmentImageDir } from '../../middlewares/upload.middleware.js';
import { AppError } from '../../utils/AppError.js';
import { nullsLast, parseSort, plain } from '../../utils/sorting.js';
import { removeStoredFile, sendStoredImage } from '../../utils/storedImage.js';

// คอลัมน์ที่เรียงได้จากหัวตาราง (ดู EquipmentTable.jsx) ไม่ระบุ = ลำดับเริ่มต้นของ repository
const sortColumns = {
  code: plain('equipment_code'),
  name: plain('equipment_name'),
  price: nullsLast('price'),
};

// page/limit กันค่าแปลกจาก query string (NaN, ติดลบ, limit ใหญ่เกินไป) และ status ต้องอยู่ใน allowedStatuses เท่านั้น
// ไม่งั้น Prisma throw เพราะ status เป็น enum ฝั่ง DB
// เพดาน 500 กันหน้าเดียวดึงข้อมูลหนักเกินไป ช่องเลือกในฟอร์มยืม/แจ้งซ่อมที่ต้องได้ครบทุกชิ้นใช้
// GET /api/available-equipment แทน (ดู options.routes.js) ไม่ได้พึ่ง endpoint นี้แล้ว
function parseListQuery(query) {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const limit = Math.min(500, Math.max(1, Math.trunc(Number(query.limit)) || 20));
  const search = String(query.search ?? '').trim() || undefined;
  const statusInput = String(query.status ?? '').trim();
  const status = allowedStatuses.includes(statusInput) ? statusInput : undefined;
  const categoryId = Number(query.category_id);
  const locationId = Number(query.location_id);

  return {
    page,
    limit,
    search,
    status,
    categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : undefined,
    locationId: Number.isInteger(locationId) && locationId > 0 ? locationId : undefined,
    orderBy: parseSort(query, sortColumns),
  };
}

export async function getEquipmentList(request, response, next) {
  try {
    const result = await equipmentService.getEquipmentList(
      parseListQuery(request.query),
    );

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getNextEquipmentCode(request, response, next) {
  try {
    const categoryId = Number(request.query.category_id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return response.status(200).json({ code: null });
    }

    const result = await equipmentService.getNextEquipmentCode(categoryId);

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getEquipmentByCode(request, response, next) {
  try {
    const equipmentCode = String(request.params.code ?? '')
      .trim()
      .toUpperCase();
    const equipment =
      await equipmentService.getEquipmentByCode(equipmentCode);

    response.status(200).json({ equipment });
  } catch (error) {
    next(error);
  }
}

export async function getDeletedEquipmentList(request, response, next) {
  try {
    const result = await equipmentService.getDeletedEquipmentList(
      parseListQuery(request.query),
    );

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getEquipmentHistory(request, response, next) {
  try {
    const { itemId } = request.validated;
    const history = await equipmentService.getEquipmentHistory(itemId);

    response.status(200).json({ history });
  } catch (error) {
    next(error);
  }
}

export async function createEquipment(request, response, next) {
  try {
    const equipment = await equipmentService.createEquipment(
      request.validated,
      Number(request.user.sub),
    );

    response.status(201).json({
      message: 'เพิ่มครุภัณฑ์สำเร็จ',
      equipment,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEquipmentStatus(request, response, next) {
  try {
    const { itemId, status } = request.validated;
    const result = await equipmentService.updateEquipmentStatus(
      itemId,
      status,
      Number(request.user.sub),
    );

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function restoreEquipment(request, response, next) {
  try {
    const { itemId } = request.validated;
    const equipment = await equipmentService.restoreEquipment(
      itemId,
      Number(request.user.sub),
    );

    response.status(200).json({
      message: 'กู้คืนครุภัณฑ์สำเร็จ',
      equipment,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteEquipment(request, response, next) {
  try {
    const { itemId } = request.validated;
    const equipment = await equipmentService.deleteEquipment(
      itemId,
      Number(request.user.sub),
    );

    response.status(200).json({
      message: 'จำหน่ายออกครุภัณฑ์สำเร็จ',
      equipment,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEquipment(request, response, next) {
  try {
    const { itemId, body } = request.validated;
    const equipment = await equipmentService.updateEquipment(
      itemId,
      body,
      Number(request.user.sub),
    );

    response.status(200).json({
      message: 'แก้ไขครุภัณฑ์สำเร็จ',
      equipment,
    });
  } catch (error) {
    next(error);
  }
}

// body: { items: [...] } ตามรูปแบบที่ scripts/export-equipment.js สร้าง แถวไหนผิดตอบ 400 พร้อมรายการแถวที่ผิด
// (ไม่ใช้ AppError เพราะต้องส่งรายละเอียดหลายแถวกลับไปให้หน้าจอแสดง)
export async function importEquipment(request, response, next) {
  try {
    const { items } = request.validated;
    const { rows, errors } = equipmentImportService.validateImportRows(items);

    if (errors) {
      return response.status(400).json({
        message: `ไฟล์มีข้อมูลไม่ถูกต้อง ${errors.length} แถว ยังไม่ได้นำเข้าเลย กรุณาแก้แล้วลองใหม่`,
        errors: errors.slice(0, 100),
      });
    }

    const result = await equipmentImportService.importEquipment(rows, Number(request.user.sub));

    response.status(200).json({ message: `นำเข้าครุภัณฑ์ ${result.created} รายการ`, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getEquipmentImage(request, response, next) {
  try {
    const { itemId } = request.validated;
    const fileName = await equipmentService.getEquipmentImageFile(itemId);

    sendStoredImage(response, next, equipmentImageDir, fileName);
  } catch (error) {
    next(error);
  }
}

// multipart field "image" (ดู uploadEquipmentImage) แทนที่รูปเดิมถ้ามี
export async function uploadEquipmentImage(request, response, next) {
  const file = request.file;

  try {
    if (!file) {
      throw new AppError(400, 'กรุณาเลือกไฟล์รูป');
    }

    const { itemId } = request.validated;
    const equipment = await equipmentService.setEquipmentImage(
      itemId,
      file.filename,
      Number(request.user.sub),
    );

    response.status(200).json({ message: 'บันทึกรูปครุภัณฑ์สำเร็จ', equipment });
  } catch (error) {
    if (file) await removeStoredFile(equipmentImageDir, file.filename);
    next(error);
  }
}

export async function deleteEquipmentImage(request, response, next) {
  try {
    const { itemId } = request.validated;
    const equipment = await equipmentService.setEquipmentImage(
      itemId,
      null,
      Number(request.user.sub),
    );

    response.status(200).json({ message: 'ลบรูปครุภัณฑ์สำเร็จ', equipment });
  } catch (error) {
    next(error);
  }
}
