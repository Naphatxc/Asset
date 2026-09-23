import * as materialService from './material.service.js';
import { nullsLast, parseSort, plain } from '../../utils/sorting.js';

// คอลัมน์ที่เรียงได้จากหัวตาราง (ดู MaterialManager.jsx) ไม่ระบุ = ลำดับเริ่มต้นของ repository
const sortColumns = {
  code: plain('material_code'),
  name: plain('material_name'),
  quantity: plain('quantity'),
  unit_price: nullsLast('unit_price'),
  expire_date: nullsLast('expire_date'),
};

const withdrawalSortColumns = {
  date: plain('withdrawn_at'),
  material: (dir) => ({ materials: { material_name: dir } }),
  user: (dir) => ({ users: { name: dir } }),
  quantity: plain('quantity'),
};

// page/limit กันค่าแปลกจาก query string (NaN, ติดลบ) เหมือน equipment.controller.js
function parseListQuery(query) {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const limit = Math.min(500, Math.max(1, Math.trunc(Number(query.limit)) || 20));
  const search = String(query.search ?? '').trim() || undefined;
  const categoryIdValue = Number(query.category_id);
  const categoryId =
    Number.isInteger(categoryIdValue) && categoryIdValue > 0
      ? categoryIdValue
      : undefined;

  return { page, limit, search, categoryId, orderBy: parseSort(query, sortColumns) };
}

export async function getMaterialList(request, response, next) {
  try {
    const result = await materialService.getMaterialList(
      parseListQuery(request.query),
    );

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getDeletedMaterialList(request, response, next) {
  try {
    const result = await materialService.getDeletedMaterialList(
      parseListQuery(request.query),
    );

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function createMaterial(request, response, next) {
  try {
    const material = await materialService.createMaterial(request.validated);

    response.status(201).json({ message: 'เพิ่มวัสดุสำเร็จ', material });
  } catch (error) {
    next(error);
  }
}

export async function updateMaterial(request, response, next) {
  try {
    const { materialId, body } = request.validated;
    const material = await materialService.updateMaterial(materialId, body);

    response.status(200).json({ message: 'แก้ไขวัสดุสำเร็จ', material });
  } catch (error) {
    next(error);
  }
}

export async function deleteMaterial(request, response, next) {
  try {
    const { materialId } = request.validated;
    const material = await materialService.deleteMaterial(materialId);

    response.status(200).json({ message: 'ลบวัสดุสำเร็จ', material });
  } catch (error) {
    next(error);
  }
}

export async function restoreMaterial(request, response, next) {
  try {
    const { materialId } = request.validated;
    const material = await materialService.restoreMaterial(materialId);

    response.status(200).json({ message: 'กู้คืนวัสดุสำเร็จ', material });
  } catch (error) {
    next(error);
  }
}

export async function withdrawMaterial(request, response, next) {
  try {
    const { materialId, quantity, remark } = request.validated;
    const userId = Number(request.user.sub);
    const result = await materialService.withdrawMaterial(
      materialId,
      userId,
      quantity,
      remark,
    );

    response.status(200).json({ message: 'เบิกวัสดุสำเร็จ', ...result });
  } catch (error) {
    next(error);
  }
}

export async function getWithdrawals(request, response, next) {
  try {
    const page = Math.max(1, Math.trunc(Number(request.query.page)) || 1);
    const limit = Math.min(
      500,
      Math.max(1, Math.trunc(Number(request.query.limit)) || 20),
    );
    const result = await materialService.getWithdrawals({
      page,
      limit,
      orderBy: parseSort(request.query, withdrawalSortColumns),
    });

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
