// โมดูลครุภัณฑ์มี Router อ่านข้อมูลสำหรับทุกคน และ Router จัดการสำหรับ Admin
import express from 'express';

import { prisma } from '../db.js';
import {
  authenticate,
  requireAdmin,
} from '../middleware/auth.js';
import { recordEquipmentHistory } from '../services/equipment-history.js';

const equipmentRouter = express.Router();
const adminEquipmentRouter = express.Router();

const equipmentInclude = {
  equipment: {
    include: {
      categories: true,
      locations: true,
    },
  },
};

// รายชื่อ field ที่ API แก้ไขทั่วไปยอมรับ (ไม่รวม code และ status)
const editableFields = [
  'equipment_name',
  'category_id',
  'location_id',
  'fiscal_year',
  'description',
  'receive_date',
  'remark',
  'price',
  'warranty_expire',
];

const allowedStatuses = [
  'available',
  'borrowed',
  'pending_repair',
  'repairing',
];

function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;

  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}

// Prisma คืน relation เป็น object ซ้อน แต่ API เดิมส่งข้อมูลแบบแบน
function serializeEquipment(item) {
  const details = item.equipment;
  const category = details.categories;
  const location = details.locations;

  return {
    item_id: item.item_id,
    equipment_code: item.equipment_code,
    status: item.status,
    price: item.price === null ? null : item.price.toString(),
    warranty_expire: item.warranty_expire,
    created_at: item.created_at,
    updated_at: item.updated_at,
    deleted_at: item.deleted_at,
    equipment_id: details.equipment_id,
    equipment_name: details.equipment_name,
    fiscal_year: details.fiscal_year,
    description: details.description,
    receive_date: details.receive_date,
    remark: details.remark,
    category_id: category.category_id,
    category_name: category.category_name,
    location_id: location?.location_id ?? null,
    location_name: location?.location_name ?? null,
    building: location?.building ?? null,
    room: location?.room ?? null,
  };
}

async function findEquipmentByItemId(
  database,
  itemId,
  { includeDeleted = false } = {},
) {
  const item = await database.equipment_items.findFirst({
    where: {
      item_id: itemId,
      ...(includeDeleted ? {} : { deleted_at: null }),
    },
    include: equipmentInclude,
  });

  return item ? serializeEquipment(item) : null;
}

// Serializable ทดแทน SELECT ... FOR UPDATE เดิม และ retry เมื่อชนกัน
async function runTransaction(callback) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: 'Serializable',
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (error.code !== 'P2034' || attempt === 3) throw error;
    }
  }

  throw new Error('Transaction failed');
}

equipmentRouter.use(authenticate);
adminEquipmentRouter.use(authenticate, requireAdmin);

// GET /api/equipment-items - รายการที่ยังไม่ถูกลบ ทุก role อ่านได้
equipmentRouter.get('/', async (_request, response) => {
  try {
    const items = await prisma.equipment_items.findMany({
      where: { deleted_at: null },
      include: equipmentInclude,
      orderBy: { item_id: 'desc' },
    });

    response.json({ equipment: items.map(serializeEquipment) });
  } catch (error) {
    console.error('Get equipment list error:', error);
    response.status(500).json({
      message: 'ไม่สามารถโหลดรายการครุภัณฑ์ได้',
    });
  }
});

// GET /api/equipment-items/:code - รายละเอียดหนึ่งชิ้น ปลายทางนี้จะใช้กับ QR
equipmentRouter.get('/:code', async (request, response) => {
  try {
    const equipmentCode = String(request.params.code ?? '')
      .trim()
      .toUpperCase();
    const item = await prisma.equipment_items.findFirst({
      where: {
        equipment_code: equipmentCode,
        deleted_at: null,
      },
      include: equipmentInclude,
    });

    if (!item) {
      return response.status(404).json({ message: 'ไม่พบครุภัณฑ์' });
    }

    response.json({ equipment: serializeEquipment(item) });
  } catch (error) {
    console.error('Get equipment error:', error);
    response.status(500).json({
      message: 'ไม่สามารถโหลดข้อมูลครุภัณฑ์ได้',
    });
  }
});

// POST /api/admin/equipment-items - เพิ่มข้อมูลและ History ใน Transaction เดียว
adminEquipmentRouter.post('/', async (request, response) => {
  try {
    const equipmentName = String(
      request.body?.equipment_name ?? '',
    ).trim();
    const equipmentCode = String(
      request.body?.equipment_code ?? '',
    )
      .trim()
      .toUpperCase();
    const categoryId = Number(request.body?.category_id);
    const locationValue = request.body?.location_id;
    const locationId =
      locationValue == null || locationValue === ''
        ? null
        : Number(locationValue);
    const fiscalYear = request.body?.fiscal_year
      ? Number(request.body.fiscal_year)
      : null;
    const description =
      String(request.body?.description ?? '').trim() || null;
    const receiveDate = toDate(request.body?.receive_date);
    const remark = String(request.body?.remark ?? '').trim() || null;
    const status = String(request.body?.status ?? 'available')
      .trim()
      .toLowerCase();
    const priceValue = request.body?.price;
    const price =
      priceValue == null || priceValue === ''
        ? null
        : Number(priceValue);
    const warrantyExpire = toDate(request.body?.warranty_expire);

    if (!equipmentName || !equipmentCode || !categoryId) {
      return response.status(400).json({
        message: 'กรุณากรอกชื่อ รหัส และหมวดหมู่ของครุภัณฑ์',
      });
    }

    if (!allowedStatuses.includes(status)) {
      return response.status(400).json({
        message: 'สถานะครุภัณฑ์ไม่ถูกต้อง',
      });
    }

    if (price !== null && (Number.isNaN(price) || price < 0)) {
      return response.status(400).json({
        message: 'ราคาครุภัณฑ์ไม่ถูกต้อง',
      });
    }

    const createdEquipment = await runTransaction(async (database) => {
      const details = await database.equipment.create({
        data: {
          equipment_name: equipmentName,
          category_id: categoryId,
          location_id: locationId,
          fiscal_year: fiscalYear,
          description,
          receive_date: receiveDate,
          remark,
        },
      });
      const item = await database.equipment_items.create({
        data: {
          equipment_id: details.equipment_id,
          equipment_name: equipmentName,
          equipment_code: equipmentCode,
          status,
          price,
          warranty_expire: warrantyExpire,
        },
      });
      const created = await findEquipmentByItemId(
        database,
        item.item_id,
      );

      await recordEquipmentHistory(database, {
        itemId: item.item_id,
        action: 'created',
        newData: created,
        changedBy: Number(request.user.sub),
      });

      return created;
    });

    response.status(201).json({
      message: 'เพิ่มครุภัณฑ์สำเร็จ',
      equipment: createdEquipment,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return response.status(409).json({
        message: 'รหัสครุภัณฑ์นี้ถูกใช้งานแล้ว',
      });
    }

    if (error.code === 'P2003') {
      return response.status(400).json({
        message: 'ไม่พบหมวดหมู่หรือสถานที่ที่เลือก',
      });
    }

    console.error('Create equipment error:', error);
    response.status(500).json({
      message: 'ไม่สามารถเพิ่มครุภัณฑ์ได้',
    });
  }
});

// GET /api/admin/equipment-items/deleted - รายการ Soft Delete
adminEquipmentRouter.get('/deleted', async (_request, response) => {
  try {
    const items = await prisma.equipment_items.findMany({
      where: { deleted_at: { not: null } },
      include: equipmentInclude,
      orderBy: { deleted_at: 'desc' },
    });

    response.json({ equipment: items.map(serializeEquipment) });
  } catch (error) {
    console.error('Get deleted equipment list error:', error);
    response.status(500).json({
      message: 'ไม่สามารถโหลดรายการครุภัณฑ์ที่ถูกลบได้',
    });
  }
});

// GET /api/admin/equipment-items/:id/history - Audit Log พร้อมชื่อผู้เปลี่ยน
adminEquipmentRouter.get('/:id/history', async (request, response) => {
  try {
    const itemId = Number(request.params.id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return response.status(400).json({
        message: 'รหัสครุภัณฑ์ไม่ถูกต้อง',
      });
    }

    const item = await prisma.equipment_items.findUnique({
      where: { item_id: itemId },
      select: { item_id: true },
    });

    if (!item) {
      return response.status(404).json({ message: 'ไม่พบครุภัณฑ์' });
    }

    const records = await prisma.equipment_history.findMany({
      where: { item_id: itemId },
      include: { users: true },
      orderBy: { history_id: 'desc' },
    });
    const history = records.map((record) => ({
      history_id: Number(record.history_id),
      action: record.action,
      old_data: record.old_data,
      new_data: record.new_data,
      created_at: record.created_at,
      changed_by: record.changed_by,
      changed_by_name: record.users?.name ?? null,
      changed_by_email: record.users?.email ?? null,
    }));

    response.json({ history });
  } catch (error) {
    console.error('Get equipment history error:', error);
    response.status(500).json({
      message: 'ไม่สามารถโหลดประวัติครุภัณฑ์ได้',
    });
  }
});

// PATCH /api/admin/equipment-items/:id/status - เปลี่ยนเฉพาะสถานะ
adminEquipmentRouter.patch('/:id/status', async (request, response) => {
  const itemId = Number(request.params.id);
  const status = String(request.body?.status ?? '')
    .trim()
    .toLowerCase();

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return response.status(400).json({
      message: 'รหัสครุภัณฑ์ไม่ถูกต้อง',
    });
  }

  if (!allowedStatuses.includes(status)) {
    return response.status(400).json({
      message: 'สถานะครุภัณฑ์ไม่ถูกต้อง',
    });
  }

  try {
    const result = await runTransaction(async (database) => {
      const current = await findEquipmentByItemId(database, itemId);

      if (!current) return { type: 'not_found' };
      if (current.status === status) {
        return { type: 'unchanged', equipment: current };
      }

      await database.equipment_items.update({
        where: { item_id: itemId },
        data: { status },
      });
      const updated = await findEquipmentByItemId(database, itemId);

      await recordEquipmentHistory(database, {
        itemId,
        action: 'status_changed',
        oldData: current,
        newData: updated,
        changedBy: Number(request.user.sub),
      });

      return { type: 'updated', equipment: updated };
    });

    if (result.type === 'not_found') {
      return response.status(404).json({ message: 'ไม่พบครุภัณฑ์' });
    }

    response.json({
      message:
        result.type === 'unchanged'
          ? 'ครุภัณฑ์อยู่ในสถานะนี้แล้ว'
          : 'เปลี่ยนสถานะครุภัณฑ์สำเร็จ',
      equipment: result.equipment,
    });
  } catch (error) {
    console.error('Update equipment status error:', error);
    response.status(500).json({
      message: 'ไม่สามารถเปลี่ยนสถานะครุภัณฑ์ได้',
    });
  }
});

// PATCH /api/admin/equipment-items/:id/restore - ทำให้ deleted_at กลับเป็น NULL
adminEquipmentRouter.patch('/:id/restore', async (request, response) => {
  const itemId = Number(request.params.id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return response.status(400).json({
      message: 'รหัสครุภัณฑ์ไม่ถูกต้อง',
    });
  }

  try {
    const result = await runTransaction(async (database) => {
      const deleted = await findEquipmentByItemId(database, itemId, {
        includeDeleted: true,
      });

      if (!deleted) return { type: 'not_found' };
      if (deleted.deleted_at === null) return { type: 'not_deleted' };

      await database.equipment_items.update({
        where: { item_id: itemId },
        data: { deleted_at: null },
      });
      const restored = await findEquipmentByItemId(database, itemId);

      await recordEquipmentHistory(database, {
        itemId,
        action: 'restored',
        oldData: deleted,
        newData: restored,
        changedBy: Number(request.user.sub),
      });

      return { type: 'restored', equipment: restored };
    });

    if (result.type === 'not_found') {
      return response.status(404).json({ message: 'ไม่พบครุภัณฑ์' });
    }
    if (result.type === 'not_deleted') {
      return response.status(400).json({
        message: 'ครุภัณฑ์นี้ยังไม่ได้ถูกลบ',
      });
    }

    response.json({
      message: 'กู้คืนครุภัณฑ์สำเร็จ',
      equipment: result.equipment,
    });
  } catch (error) {
    console.error('Restore equipment error:', error);
    response.status(500).json({
      message: 'ไม่สามารถกู้คืนครุภัณฑ์ได้',
    });
  }
});

// DELETE /api/admin/equipment-items/:id - Soft Delete
adminEquipmentRouter.delete('/:id', async (request, response) => {
  const itemId = Number(request.params.id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return response.status(400).json({
      message: 'รหัสครุภัณฑ์ไม่ถูกต้อง',
    });
  }

  try {
    const result = await runTransaction(async (database) => {
      const current = await findEquipmentByItemId(database, itemId);
      if (!current) return null;

      await database.equipment_items.update({
        where: { item_id: itemId },
        data: { deleted_at: new Date() },
      });
      const deleted = await findEquipmentByItemId(database, itemId, {
        includeDeleted: true,
      });

      await recordEquipmentHistory(database, {
        itemId,
        action: 'deleted',
        oldData: current,
        newData: deleted,
        changedBy: Number(request.user.sub),
      });

      return deleted;
    });

    if (!result) {
      return response.status(404).json({ message: 'ไม่พบครุภัณฑ์' });
    }

    response.json({
      message: 'ลบครุภัณฑ์สำเร็จ',
      equipment: result,
    });
  } catch (error) {
    console.error('Delete equipment error:', error);
    response.status(500).json({
      message: 'ไม่สามารถลบครุภัณฑ์ได้',
    });
  }
});

// PATCH /api/admin/equipment-items/:id - แก้ข้อมูลทั่วไป ยกเว้น code และ status
adminEquipmentRouter.patch('/:id', async (request, response) => {
  const itemId = Number(request.params.id);
  const body = request.body ?? {};

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return response.status(400).json({
      message: 'รหัสครุภัณฑ์ไม่ถูกต้อง',
    });
  }

  if (!editableFields.some((field) => hasOwn(body, field))) {
    return response.status(400).json({
      message: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข',
    });
  }

  try {
    const result = await runTransaction(async (database) => {
      const current = await findEquipmentByItemId(database, itemId);
      if (!current) return { error: 'ไม่พบครุภัณฑ์', status: 404 };

      const equipmentName = hasOwn(body, 'equipment_name')
        ? String(body.equipment_name ?? '').trim()
        : current.equipment_name;
      const categoryId = hasOwn(body, 'category_id')
        ? Number(body.category_id)
        : current.category_id;
      const locationId = hasOwn(body, 'location_id')
        ? body.location_id == null || body.location_id === ''
          ? null
          : Number(body.location_id)
        : current.location_id;
      const fiscalYear = hasOwn(body, 'fiscal_year')
        ? body.fiscal_year == null || body.fiscal_year === ''
          ? null
          : Number(body.fiscal_year)
        : current.fiscal_year;
      const description = hasOwn(body, 'description')
        ? String(body.description ?? '').trim() || null
        : current.description;
      const receiveDate = hasOwn(body, 'receive_date')
        ? toDate(body.receive_date)
        : current.receive_date;
      const remark = hasOwn(body, 'remark')
        ? String(body.remark ?? '').trim() || null
        : current.remark;
      const price = hasOwn(body, 'price')
        ? body.price == null || body.price === ''
          ? null
          : Number(body.price)
        : current.price;
      const warrantyExpire = hasOwn(body, 'warranty_expire')
        ? toDate(body.warranty_expire)
        : current.warranty_expire;

      if (!equipmentName) {
        return { error: 'กรุณากรอกชื่อครุภัณฑ์', status: 400 };
      }
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return { error: 'หมวดหมู่ไม่ถูกต้อง', status: 400 };
      }
      if (
        locationId !== null &&
        (!Number.isInteger(locationId) || locationId <= 0)
      ) {
        return { error: 'สถานที่ไม่ถูกต้อง', status: 400 };
      }
      if (
        fiscalYear !== null &&
        (!Number.isInteger(fiscalYear) ||
          fiscalYear < 1901 ||
          fiscalYear > 2155)
      ) {
        return { error: 'ปีงบประมาณไม่ถูกต้อง', status: 400 };
      }
      if (
        price !== null &&
        (Number.isNaN(Number(price)) || Number(price) < 0)
      ) {
        return { error: 'ราคาครุภัณฑ์ไม่ถูกต้อง', status: 400 };
      }

      await database.equipment.update({
        where: { equipment_id: current.equipment_id },
        data: {
          equipment_name: equipmentName,
          category_id: categoryId,
          location_id: locationId,
          fiscal_year: fiscalYear,
          description,
          receive_date: receiveDate,
          remark,
        },
      });
      await database.equipment_items.update({
        where: { item_id: itemId },
        data: {
          equipment_name: equipmentName,
          price,
          warranty_expire: warrantyExpire,
        },
      });

      const updated = await findEquipmentByItemId(database, itemId);
      await recordEquipmentHistory(database, {
        itemId,
        action: 'updated',
        oldData: current,
        newData: updated,
        changedBy: Number(request.user.sub),
      });

      return { equipment: updated };
    });

    if (result.error) {
      return response.status(result.status).json({ message: result.error });
    }

    response.json({
      message: 'แก้ไขครุภัณฑ์สำเร็จ',
      equipment: result.equipment,
    });
  } catch (error) {
    if (error.code === 'P2003') {
      return response.status(400).json({
        message: 'ไม่พบหมวดหมู่หรือสถานที่ที่เลือก',
      });
    }

    console.error('Update equipment error:', error);
    response.status(500).json({
      message: 'ไม่สามารถแก้ไขครุภัณฑ์ได้',
    });
  }
});

export { adminEquipmentRouter };
export default equipmentRouter;
