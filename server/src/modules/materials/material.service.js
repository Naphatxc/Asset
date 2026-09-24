// Business Logic สำหรับวัสดุ — ต่างจากครุภัณฑ์ตรงที่ "เบิก" ตัดยอดทันที ไม่มีขั้นตอนรออนุมัติ (ดู withdrawMaterial)
// วัสดุสิ้นเปลืองเบิกแล้วจบ ส่วนวัสดุที่ต้องคืน (is_returnable) ต้องระบุวันครบกำหนดคืน และ Admin รับคืนเข้าสต๊อก
// (ดู returnWithdrawal) ส่วน CRUD ทั่วไป (เพิ่ม/แก้ไข/ลบ/กู้คืน) เป็นสิทธิ์ Admin ล้วนๆ
import * as materialRepository from './material.repository.js';
import { AppError } from '../../utils/AppError.js';
import { isPastDueDate } from '../../utils/dueDate.js';
import { materialImageDir } from '../../middlewares/upload.middleware.js';
import { hasOwn, toDate } from '../../utils/parsing.js';
import { removeStoredImage } from '../../utils/storedImage.js';
import { runSerializableTransaction } from '../../utils/transaction.js';
import {
  MAX_LONG_TEXT_LENGTH,
  MAX_MATERIAL_NAME_LENGTH,
  MAX_UNIT_NAME_LENGTH,
} from './material.validator.js';

function serializeMaterial(material) {
  return {
    material_id: material.material_id,
    material_code: material.material_code,
    material_name: material.material_name,
    category_id: material.category_id,
    category_name: material.categories?.category_name ?? null,
    quantity: material.quantity,
    minimum_quantity: material.minimum_quantity,
    // ตัด boolean สำเร็จรูปให้ client เทียบเลยไม่ต้อง derive เอง (เกณฑ์เดียวกันทุกที่ที่แสดงผล)
    low_stock: material.quantity <= material.minimum_quantity,
    expire_date: material.expire_date,
    unit_name: material.unit_name,
    unit_price:
      material.unit_price === null ? null : material.unit_price.toString(),
    remark: material.remark,
    is_returnable: material.is_returnable,
    deleted_at: material.deleted_at,
    // ?v= เปลี่ยนตามชื่อไฟล์ เหมือน image_url ของครุภัณฑ์ (ดู equipment.service.js)
    image_url: material.image_path
      ? `/api/materials/${material.material_id}/image?v=${encodeURIComponent(material.image_path)}`
      : null,
  };
}

// consumed = วัสดุสิ้นเปลือง (ไม่ต้องคืน) ส่วนใบที่ต้องคืน derive จาก due_date/returned_at แบบเดียวกับ
// สถานะครุภัณฑ์ที่ยืม (borrow.service.js) ไม่เก็บเป็น column แยก กันข้อมูลไม่ตรงกัน
function withdrawalStatus(row) {
  if (!row.due_date) return 'consumed';
  if (row.returned_at) return 'returned';
  return isPastDueDate(row.due_date) ? 'overdue' : 'borrowed';
}

function serializeWithdrawal(row) {
  return {
    withdrawal_id: row.withdrawal_id,
    material_id: row.material_id,
    material_code: row.materials?.material_code ?? null,
    material_name: row.materials?.material_name ?? null,
    unit_name: row.materials?.unit_name ?? null,
    user_id: row.user_id,
    user_name: row.users?.name ?? null,
    user_email: row.users?.email ?? null,
    quantity: row.quantity,
    remark: row.remark,
    withdrawn_at: row.withdrawn_at,
    due_date: row.due_date,
    returned_quantity: row.returned_quantity,
    outstanding_quantity: row.due_date ? row.quantity - row.returned_quantity : 0,
    returned_at: row.returned_at,
    status: withdrawalStatus(row),
  };
}

function serializePagination({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getMaterialList({ page = 1, limit = 20, search, categoryId, orderBy } = {}) {
  try {
    const { items, total } = await materialRepository.findManyActive({
      page,
      limit,
      search,
      categoryId,
      orderBy,
    });

    return {
      materials: items.map(serializeMaterial),
      pagination: serializePagination({ page, limit, total }),
    };
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการวัสดุได้', { cause: error });
  }
}

export async function getDeletedMaterialList({
  page = 1,
  limit = 20,
  search,
  categoryId,
  orderBy,
} = {}) {
  try {
    const { items, total } = await materialRepository.findManyDeleted({
      page,
      limit,
      search,
      categoryId,
      orderBy,
    });

    return {
      materials: items.map(serializeMaterial),
      pagination: serializePagination({ page, limit, total }),
    };
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการวัสดุที่ถูกลบได้', {
      cause: error,
    });
  }
}

export async function createMaterial(payload) {
  try {
    const material = await materialRepository.create({
      material_code: payload.materialCode,
      material_name: payload.materialName,
      category_id: payload.categoryId,
      quantity: payload.quantity,
      minimum_quantity: payload.minimumQuantity,
      expire_date: payload.expireDate,
      unit_name: payload.unitName,
      unit_price: payload.unitPrice,
      remark: payload.remark,
      is_returnable: payload.isReturnable,
    });

    return serializeMaterial(material);
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'รหัสวัสดุนี้ถูกใช้งานแล้ว');
    }
    if (error.code === 'P2003') {
      throw new AppError(400, 'ไม่พบหมวดหมู่ที่เลือก');
    }

    throw new AppError(500, 'ไม่สามารถเพิ่มวัสดุได้', { cause: error });
  }
}

// body ผ่าน validator แล้วว่ามีอย่างน้อย 1 field ที่แก้ไขได้ ส่วนช่วง/ความถูกต้องของแต่ละ field ต้อง merge
// กับ current ก่อน จึงตรวจใน Service นี้แทน validator (เหมือน equipment.service.js)
export async function updateMaterial(materialId, body) {
  try {
    const current = await materialRepository.findById(materialId);
    if (!current) throw new AppError(404, 'ไม่พบวัสดุ');

    const materialName = hasOwn(body, 'material_name')
      ? String(body.material_name ?? '').trim()
      : current.material_name;
    const categoryId = hasOwn(body, 'category_id')
      ? Number(body.category_id)
      : current.category_id;
    const quantity = hasOwn(body, 'quantity')
      ? Number(body.quantity)
      : current.quantity;
    const minimumQuantity = hasOwn(body, 'minimum_quantity')
      ? Number(body.minimum_quantity)
      : current.minimum_quantity;
    const expireDate = hasOwn(body, 'expire_date')
      ? toDate(body.expire_date)
      : current.expire_date;
    const unitName = hasOwn(body, 'unit_name')
      ? String(body.unit_name ?? '').trim()
      : current.unit_name;
    const unitPrice = hasOwn(body, 'unit_price')
      ? body.unit_price == null || body.unit_price === ''
        ? null
        : Number(body.unit_price)
      : current.unit_price;
    const remark = hasOwn(body, 'remark')
      ? String(body.remark ?? '').trim() || null
      : current.remark;
    // เปลี่ยนธงแล้วมีผลกับการเบิกครั้งถัดไปเท่านั้น ใบเบิกเก่าที่ยังค้างคืนยังต้องคืนตาม due_date ของใบนั้น
    const isReturnable = hasOwn(body, 'is_returnable')
      ? body.is_returnable === true
      : current.is_returnable;

    if (!materialName) {
      throw new AppError(400, 'กรุณากรอกชื่อวัสดุ');
    }
    if (materialName.length > MAX_MATERIAL_NAME_LENGTH) {
      throw new AppError(400, `ชื่อวัสดุต้องไม่เกิน ${MAX_MATERIAL_NAME_LENGTH} ตัวอักษร`);
    }
    if (!unitName) {
      throw new AppError(400, 'กรุณากรอกหน่วยนับ');
    }
    if (unitName.length > MAX_UNIT_NAME_LENGTH) {
      throw new AppError(400, `หน่วยนับต้องไม่เกิน ${MAX_UNIT_NAME_LENGTH} ตัวอักษร`);
    }
    if (remark && remark.length > MAX_LONG_TEXT_LENGTH) {
      throw new AppError(400, `หมายเหตุต้องไม่เกิน ${MAX_LONG_TEXT_LENGTH} ตัวอักษร`);
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new AppError(400, 'จำนวนคงเหลือไม่ถูกต้อง');
    }
    if (!Number.isInteger(minimumQuantity) || minimumQuantity < 0) {
      throw new AppError(400, 'จำนวนขั้นต่ำไม่ถูกต้อง');
    }
    if (unitPrice !== null && (Number.isNaN(unitPrice) || unitPrice < 0)) {
      throw new AppError(400, 'ราคาต่อหน่วยไม่ถูกต้อง');
    }

    const merged = {
      material_name: materialName,
      category_id: categoryId,
      quantity,
      minimum_quantity: minimumQuantity,
      expire_date: expireDate,
      unit_name: unitName,
      unit_price: unitPrice,
      remark,
      is_returnable: isReturnable,
    };
    // ตรวจจากค่าที่ merge แล้ว แต่เขียนลง DB เฉพาะ field ที่ส่งมาจริง โดยเฉพาะ quantity: ถ้าเขียนค่าที่อ่านไว้
    // กลับไปทุกครั้ง การเบิกที่เกิดขึ้นระหว่างนั้นจะถูกทับหาย ยอดคงเหลือไม่ตรงกับประวัติการเบิก
    const data = Object.fromEntries(
      Object.entries(merged).filter(([field]) => hasOwn(body, field)),
    );
    const updated = await materialRepository.update(materialId, data);

    return serializeMaterial(updated);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.code === 'P2003') {
      throw new AppError(400, 'ไม่พบหมวดหมู่ที่เลือก');
    }

    throw new AppError(500, 'ไม่สามารถแก้ไขวัสดุได้', { cause: error });
  }
}

export async function deleteMaterial(materialId) {
  try {
    const current = await materialRepository.findById(materialId);
    if (!current) throw new AppError(404, 'ไม่พบวัสดุ');

    await materialRepository.softDelete(materialId);

    return serializeMaterial({ ...current, deleted_at: new Date() });
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถลบวัสดุได้', { cause: error });
  }
}

export async function restoreMaterial(materialId) {
  try {
    const current = await materialRepository.findById(materialId, {
      includeDeleted: true,
    });
    if (!current) throw new AppError(404, 'ไม่พบวัสดุ');
    if (current.deleted_at === null) {
      throw new AppError(400, 'วัสดุนี้ยังไม่ได้ถูกลบ');
    }

    const restored = await materialRepository.restore(materialId);

    return serializeMaterial(restored);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถกู้คืนวัสดุได้', { cause: error });
  }
}

// เบิกแล้วตัดยอดทันที ไม่มีขั้นตอนรออนุมัติ (ต่างจากยืมครุภัณฑ์) — เช็คจำนวนคงเหลือใน Transaction เดียวกัน
// กับตอนตัดยอด (Serializable) กันกรณีเบิกพร้อมกันหลายคนจนยอดติดลบ
// dueDate (ผ่าน validator แล้วว่าเป็นวันในอนาคต) บังคับเฉพาะวัสดุที่ต้องคืน วัสดุสิ้นเปลืองไม่เก็บแม้ส่งมา
// เพราะ due_date ที่มีค่าคือเครื่องหมายว่าใบนี้ต้องคืน
export async function withdrawMaterial(materialId, userId, quantity, remark, dueDate) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const current = await materialRepository.findById(materialId, {
        client: tx,
      });
      if (!current) return { type: 'not_found' };
      if (current.is_returnable && !dueDate) return { type: 'due_date_required' };
      if (current.quantity < quantity) {
        return { type: 'insufficient', available: current.quantity, unitName: current.unit_name };
      }

      await materialRepository.decrementQuantity(materialId, quantity, tx);
      const withdrawal = await materialRepository.createWithdrawal(
        {
          material_id: materialId,
          user_id: userId,
          quantity,
          remark,
          due_date: current.is_returnable ? dueDate : null,
        },
        tx,
      );
      const updated = await materialRepository.findById(materialId, {
        client: tx,
      });

      return { type: 'ok', material: updated, withdrawal };
    });

    if (result.type === 'not_found') {
      throw new AppError(404, 'ไม่พบวัสดุ');
    }
    if (result.type === 'due_date_required') {
      throw new AppError(400, 'วัสดุนี้ต้องนำมาคืน กรุณาระบุวันครบกำหนดคืน');
    }
    if (result.type === 'insufficient') {
      throw new AppError(409, `วัสดุคงเหลือไม่พอ (เหลือ ${result.available} ${result.unitName})`);
    }

    return {
      material: serializeMaterial(result.material),
      withdrawal: serializeWithdrawal(result.withdrawal),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถเบิกวัสดุได้', { cause: error });
  }
}

export async function getWithdrawals({
  page = 1,
  limit = 20,
  materialId,
  userId,
  outstanding,
  orderBy,
} = {}) {
  try {
    const { items, total } = await materialRepository.findWithdrawals({
      page,
      limit,
      materialId,
      userId,
      outstanding,
      orderBy,
    });

    return {
      withdrawals: items.map(serializeWithdrawal),
      pagination: serializePagination({ page, limit, total }),
    };
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดประวัติการเบิกได้', { cause: error });
  }
}

// Admin รับคืนวัสดุ คืนทีละส่วนได้ (quantity ไม่เกินยอดที่ยังค้าง) บวกยอดกลับเข้าสต๊อกใน Transaction เดียวกับ
// ที่บันทึกการคืน คืนครบแล้วตั้ง returned_at ปิดใบ รับคืนได้แม้วัสดุถูกลบไปแล้ว (ของยังอยู่กับผู้เบิก ต้องคืนได้)
// ของเสีย/หายไม่มีขั้นตอนพิเศษ Admin ปรับยอดคงเหลือที่ตัววัสดุเอง
export async function returnWithdrawal(withdrawalId, adminId, quantity, remark) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const current = await materialRepository.findWithdrawalById(withdrawalId, tx);
      if (!current) return { type: 'not_found' };
      if (!current.due_date) return { type: 'not_returnable' };
      if (current.returned_at) return { type: 'already_returned' };

      const outstanding = current.quantity - current.returned_quantity;
      if (quantity > outstanding) return { type: 'too_many', outstanding };

      await materialRepository.createReturn(
        { withdrawal_id: withdrawalId, quantity, remark, received_by: adminId },
        tx,
      );
      await materialRepository.incrementQuantity(current.material_id, quantity, tx);
      const withdrawal = await materialRepository.updateWithdrawal(
        withdrawalId,
        {
          returned_quantity: { increment: quantity },
          ...(quantity === outstanding ? { returned_at: new Date() } : {}),
        },
        tx,
      );

      return { type: 'ok', withdrawal };
    });

    if (result.type === 'not_found') {
      throw new AppError(404, 'ไม่พบรายการเบิก');
    }
    if (result.type === 'not_returnable') {
      throw new AppError(400, 'รายการนี้เป็นวัสดุสิ้นเปลือง ไม่ต้องคืน');
    }
    if (result.type === 'already_returned') {
      throw new AppError(409, 'รายการนี้คืนครบแล้ว');
    }
    if (result.type === 'too_many') {
      throw new AppError(400, `คืนได้ไม่เกินจำนวนที่ยังค้าง (${result.outstanding})`);
    }

    return serializeWithdrawal(result.withdrawal);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถบันทึกการรับคืนได้', { cause: error });
  }
}

// ดูรูปได้ทั้งของที่ถูกลบแล้ว (หน้ารายการที่ลบของ Admin ยังแสดงรูปอยู่)
export async function getMaterialImageFile(materialId) {
  const material = await materialRepository.findById(materialId, { includeDeleted: true });

  if (!material?.image_path) {
    throw new AppError(404, 'วัสดุนี้ยังไม่มีรูป');
  }

  return material.image_path;
}

// imagePath = ชื่อไฟล์ใหม่ที่ multer เขียนลง disk แล้ว หรือ null เพื่อลบรูป ไฟล์เดิมลบหลังอัปเดต DB สำเร็จเท่านั้น
export async function setMaterialImage(materialId, imagePath) {
  try {
    const current = await materialRepository.findById(materialId);
    if (!current) throw new AppError(404, 'ไม่พบวัสดุ');

    const updated = await materialRepository.update(materialId, { image_path: imagePath });
    await removeStoredImage(materialImageDir, current.image_path);

    return serializeMaterial(updated);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถบันทึกรูปวัสดุได้', { cause: error });
  }
}
