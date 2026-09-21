// Business Logic สำหรับวัสดุ — ต่างจากครุภัณฑ์ตรงที่ "เบิก" ตัดยอดทันที ไม่มีขั้นตอนรออนุมัติ เพราะวัสดุใช้แล้ว
// หมดไป ไม่มีการคืน (ดู withdrawMaterial) ส่วน CRUD ทั่วไป (เพิ่ม/แก้ไข/ลบ/กู้คืน) เป็นสิทธิ์ Admin ล้วนๆ
import * as materialRepository from './material.repository.js';
import { AppError } from '../../utils/AppError.js';
import { hasOwn, toDate } from '../../utils/parsing.js';
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
    deleted_at: material.deleted_at,
  };
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
  };
}

function serializePagination({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getMaterialList({ page = 1, limit = 20, search, categoryId } = {}) {
  try {
    const { items, total } = await materialRepository.findManyActive({
      page,
      limit,
      search,
      categoryId,
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
} = {}) {
  try {
    const { items, total } = await materialRepository.findManyDeleted({
      page,
      limit,
      search,
      categoryId,
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
export async function withdrawMaterial(materialId, userId, quantity, remark) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const current = await materialRepository.findById(materialId, {
        client: tx,
      });
      if (!current) return { type: 'not_found' };
      if (current.quantity < quantity) {
        return { type: 'insufficient', available: current.quantity };
      }

      await materialRepository.decrementQuantity(materialId, quantity, tx);
      const withdrawal = await materialRepository.createWithdrawal(
        { material_id: materialId, user_id: userId, quantity, remark },
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
    if (result.type === 'insufficient') {
      throw new AppError(409, `วัสดุคงเหลือไม่พอ (เหลือ ${result.available} ชิ้น)`);
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

export async function getWithdrawals({ page = 1, limit = 20, materialId, userId } = {}) {
  try {
    const { items, total } = await materialRepository.findWithdrawals({
      page,
      limit,
      materialId,
      userId,
    });

    return {
      withdrawals: items.map(serializeWithdrawal),
      pagination: serializePagination({ page, limit, total }),
    };
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดประวัติการเบิกได้', { cause: error });
  }
}
