// Business Logic สำหรับครุภัณฑ์ — ควบคุม transaction (Service เท่านั้นที่เรียก prisma.$transaction ได้)
// และแปลงข้อมูลจาก Prisma (nested include) ให้เป็นรูปแบบแบนตาม API เดิมก่อนส่งกลับ Controller
import * as equipmentHistoryRepository from './equipment-history.repository.js';
import * as equipmentRepository from './equipment.repository.js';
import { AppError } from '../../utils/AppError.js';
import { hasOwn, toDate } from '../../utils/parsing.js';
import { runSerializableTransaction } from '../../utils/transaction.js';
import * as borrowRepository from '../borrow/borrow.repository.js';
import * as repairRepository from '../repair/repair.repository.js';

// ใช้ก่อนเปลี่ยนสถานะ/ลบครุภัณฑ์ตรงๆ กันไม่ให้ทับสถานะที่ borrow/repair flow ควบคุมอยู่ (เช่น ตั้งกลับเป็น
// available ทั้งที่มีคนยืมค้างอยู่จริง) คืน error message ถ้าเจอ ไม่งั้นคืน null ให้ caller ทำงานต่อได้
async function checkNoActiveBorrowOrRepair(itemId, actionLabel, tx) {
  const openBorrow = await borrowRepository.findOpenDetailByItemId(itemId, tx);
  if (openBorrow) {
    return `ครุภัณฑ์นี้มีการยืมค้างอยู่ ไม่สามารถ${actionLabel}ได้`;
  }

  const activeRepair = await repairRepository.findActiveByItemId(itemId, tx);
  if (activeRepair) {
    return `ครุภัณฑ์นี้กำลังอยู่ระหว่างการซ่อม ไม่สามารถ${actionLabel}ได้`;
  }

  return null;
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

async function getSerializedByItemId(
  itemId,
  { includeDeleted = false, client } = {},
) {
  const item = await equipmentRepository.findByItemId(itemId, {
    includeDeleted,
    client,
  });

  return item ? serializeEquipment(item) : null;
}

function serializePagination({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getEquipmentList({ page = 1, limit = 20, search, status } = {}) {
  try {
    const { items, total } = await equipmentRepository.findManyActive({
      page,
      limit,
      search,
      status,
    });

    return {
      equipment: items.map(serializeEquipment),
      pagination: serializePagination({ page, limit, total }),
    };
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการครุภัณฑ์ได้', {
      cause: error,
    });
  }
}

export async function getDeletedEquipmentList({
  page = 1,
  limit = 20,
  search,
  status,
} = {}) {
  try {
    const { items, total } = await equipmentRepository.findManyDeleted({
      page,
      limit,
      search,
      status,
    });

    return {
      equipment: items.map(serializeEquipment),
      pagination: serializePagination({ page, limit, total }),
    };
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการครุภัณฑ์ที่ถูกลบได้', {
      cause: error,
    });
  }
}

export async function getEquipmentByCode(equipmentCode) {
  try {
    const item = await equipmentRepository.findByCode(equipmentCode);

    if (!item) {
      throw new AppError(404, 'ไม่พบครุภัณฑ์');
    }

    return serializeEquipment(item);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถโหลดข้อมูลครุภัณฑ์ได้', {
      cause: error,
    });
  }
}

export async function getEquipmentHistory(itemId) {
  try {
    const item = await equipmentRepository.existsById(itemId);

    if (!item) {
      throw new AppError(404, 'ไม่พบครุภัณฑ์');
    }

    const records = await equipmentHistoryRepository.findByItemId(itemId);

    return records.map((record) => ({
      history_id: Number(record.history_id),
      action: record.action,
      old_data: record.old_data,
      new_data: record.new_data,
      created_at: record.created_at,
      changed_by: record.changed_by,
      changed_by_name: record.users?.name ?? null,
      changed_by_email: record.users?.email ?? null,
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถโหลดประวัติครุภัณฑ์ได้', {
      cause: error,
    });
  }
}

export async function createEquipment(payload, actorId) {
  try {
    return await runSerializableTransaction(async (tx) => {
      const details = await equipmentRepository.createEquipmentDetails(
        {
          equipment_name: payload.equipmentName,
          category_id: payload.categoryId,
          location_id: payload.locationId,
          fiscal_year: payload.fiscalYear,
          description: payload.description,
          receive_date: payload.receiveDate,
          remark: payload.remark,
        },
        tx,
      );
      const item = await equipmentRepository.createEquipmentItem(
        {
          equipment_id: details.equipment_id,
          equipment_name: payload.equipmentName,
          equipment_code: payload.equipmentCode,
          status: payload.status,
          price: payload.price,
          warranty_expire: payload.warrantyExpire,
        },
        tx,
      );
      const created = await getSerializedByItemId(item.item_id, {
        client: tx,
      });

      await equipmentHistoryRepository.create(
        {
          itemId: item.item_id,
          action: 'created',
          newData: created,
          changedBy: actorId,
        },
        tx,
      );

      return created;
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'รหัสครุภัณฑ์นี้ถูกใช้งานแล้ว');
    }

    if (error.code === 'P2003') {
      throw new AppError(400, 'ไม่พบหมวดหมู่หรือสถานที่ที่เลือก');
    }

    throw new AppError(500, 'ไม่สามารถเพิ่มครุภัณฑ์ได้', { cause: error });
  }
}

export async function updateEquipmentStatus(itemId, status, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const current = await getSerializedByItemId(itemId, { client: tx });

      if (!current) return { type: 'not_found' };
      if (current.status === status) {
        return { type: 'unchanged', equipment: current };
      }

      const conflict = await checkNoActiveBorrowOrRepair(
        itemId,
        'เปลี่ยนสถานะ',
        tx,
      );
      if (conflict) return { type: 'conflict', error: conflict };

      await equipmentRepository.updateEquipmentItem(itemId, { status }, tx);
      const updated = await getSerializedByItemId(itemId, { client: tx });

      await equipmentHistoryRepository.create(
        {
          itemId,
          action: 'status_changed',
          oldData: current,
          newData: updated,
          changedBy: actorId,
        },
        tx,
      );

      return { type: 'updated', equipment: updated };
    });

    if (result.type === 'not_found') {
      throw new AppError(404, 'ไม่พบครุภัณฑ์');
    }
    if (result.type === 'conflict') {
      throw new AppError(409, result.error);
    }

    return {
      message:
        result.type === 'unchanged'
          ? 'ครุภัณฑ์อยู่ในสถานะนี้แล้ว'
          : 'เปลี่ยนสถานะครุภัณฑ์สำเร็จ',
      equipment: result.equipment,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถเปลี่ยนสถานะครุภัณฑ์ได้', {
      cause: error,
    });
  }
}

export async function restoreEquipment(itemId, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const deleted = await getSerializedByItemId(itemId, {
        includeDeleted: true,
        client: tx,
      });

      if (!deleted) return { type: 'not_found' };
      if (deleted.deleted_at === null) return { type: 'not_deleted' };

      await equipmentRepository.restore(itemId, tx);
      const restored = await getSerializedByItemId(itemId, { client: tx });

      await equipmentHistoryRepository.create(
        {
          itemId,
          action: 'restored',
          oldData: deleted,
          newData: restored,
          changedBy: actorId,
        },
        tx,
      );

      return { type: 'restored', equipment: restored };
    });

    if (result.type === 'not_found') {
      throw new AppError(404, 'ไม่พบครุภัณฑ์');
    }
    if (result.type === 'not_deleted') {
      throw new AppError(400, 'ครุภัณฑ์นี้ยังไม่ได้ถูกลบ');
    }

    return result.equipment;
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถกู้คืนครุภัณฑ์ได้', { cause: error });
  }
}

export async function deleteEquipment(itemId, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const current = await getSerializedByItemId(itemId, { client: tx });
      if (!current) return { type: 'not_found' };

      const conflict = await checkNoActiveBorrowOrRepair(itemId, 'ลบ', tx);
      if (conflict) return { type: 'conflict', error: conflict };

      await equipmentRepository.softDelete(itemId, tx);
      const deleted = await getSerializedByItemId(itemId, {
        includeDeleted: true,
        client: tx,
      });

      await equipmentHistoryRepository.create(
        {
          itemId,
          action: 'deleted',
          oldData: current,
          newData: deleted,
          changedBy: actorId,
        },
        tx,
      );

      return { type: 'deleted', equipment: deleted };
    });

    if (result.type === 'not_found') {
      throw new AppError(404, 'ไม่พบครุภัณฑ์');
    }
    if (result.type === 'conflict') {
      throw new AppError(409, result.error);
    }

    return result.equipment;
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถลบครุภัณฑ์ได้', { cause: error });
  }
}

// body ที่รับมาผ่าน validator ตรวจแล้วว่ามีอย่างน้อย 1 field ที่แก้ไขได้ (editableFields)
// ส่วนช่วง/ความถูกต้องของแต่ละ field ต้อง merge กับ current ก่อน จึงตรวจใน Service นี้แทน validator
export async function updateEquipment(itemId, body, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const current = await getSerializedByItemId(itemId, { client: tx });
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

      await equipmentRepository.updateEquipmentDetails(
        current.equipment_id,
        {
          equipment_name: equipmentName,
          category_id: categoryId,
          location_id: locationId,
          fiscal_year: fiscalYear,
          description,
          receive_date: receiveDate,
          remark,
        },
        tx,
      );
      await equipmentRepository.updateEquipmentItem(
        itemId,
        {
          equipment_name: equipmentName,
          price,
          warranty_expire: warrantyExpire,
        },
        tx,
      );

      const updated = await getSerializedByItemId(itemId, { client: tx });

      await equipmentHistoryRepository.create(
        {
          itemId,
          action: 'updated',
          oldData: current,
          newData: updated,
          changedBy: actorId,
        },
        tx,
      );

      return { equipment: updated };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return result.equipment;
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2003') {
      throw new AppError(400, 'ไม่พบหมวดหมู่หรือสถานที่ที่เลือก');
    }

    throw new AppError(500, 'ไม่สามารถแก้ไขครุภัณฑ์ได้', { cause: error });
  }
}
