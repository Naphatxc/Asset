// โมดูลครุภัณฑ์มี Router อ่านข้อมูลสำหรับทุกคน และ Router จัดการสำหรับ Admin
import express from 'express';

import { pool } from '../db.js';
import {
  authenticate,
  requireAdmin,
} from '../middleware/auth.js';
import { recordEquipmentHistory } from '../services/equipment-history.js';

const equipmentRouter = express.Router();
const adminEquipmentRouter = express.Router();

// SELECT และ JOIN ชุดเดียวกันถูกใช้หลาย endpoint จึงประกาศไว้ครั้งเดียว
const equipmentColumns = `
  ei.item_id,
  ei.equipment_code,
  ei.status,
  ei.price,
  ei.warranty_expire,
  ei.created_at,
  ei.updated_at,
  ei.deleted_at,
  e.equipment_id,
  e.equipment_name,
  e.fiscal_year,
  e.description,
  e.receive_date,
  e.remark,
  c.category_id,
  c.category_name,
  l.location_id,
  l.location_name,
  l.building,
  l.room
`;

const equipmentJoins = `
  FROM equipment_items AS ei
  JOIN equipment AS e
    ON ei.equipment_id = e.equipment_id
  JOIN categories AS c
    ON e.category_id = c.category_id
  LEFT JOIN locations AS l
    ON e.location_id = l.location_id
`;

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

// ค่า status ต้องตรงกับ ENUM ใน MySQL
const allowedStatuses = [
  'available',
  'borrowed',
  'pending_repair',
  'repairing',
];

function hasOwn(object, property) {
  // แยกให้ออกระหว่าง "ไม่ได้ส่ง field" กับ "ส่ง field มาเป็น null"
  return Object.prototype.hasOwnProperty.call(object, property);
}

// Helper ค้นหาครุภัณฑ์ด้วย item_id และเลือกได้ว่าจะรวมของที่ Soft Delete หรือไม่
async function findEquipmentByItemId(
  database,
  itemId,
  { lock = false, includeDeleted = false } = {},
) {
  // FOR UPDATE ล็อกแถวไว้ระหว่าง Transaction ป้องกัน Admin สองคนแก้พร้อมกัน
  const lockClause = lock ? 'FOR UPDATE' : '';
  const deletedClause = includeDeleted
    ? ''
    : 'AND ei.deleted_at IS NULL';
  const [items] = await database.execute(
    `SELECT ${equipmentColumns}
     ${equipmentJoins}
     WHERE ei.item_id = ?
       ${deletedClause}
     LIMIT 1
     ${lockClause}`,
    [itemId],
  );

  return items[0] ?? null;
}

equipmentRouter.use(authenticate);
adminEquipmentRouter.use(authenticate, requireAdmin);

// GET /api/equipment-items - รายการที่ยังไม่ถูกลบ ทุก role อ่านได้
equipmentRouter.get('/', async (_request, response) => {
  try {
    const [equipmentItems] = await pool.query(
      `SELECT ${equipmentColumns}
       ${equipmentJoins}
       WHERE ei.deleted_at IS NULL
       ORDER BY ei.item_id DESC`,
    );

    response.json({
      equipment: equipmentItems,
    });
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

    const [items] = await pool.execute(
      `SELECT ${equipmentColumns}
       ${equipmentJoins}
       WHERE ei.equipment_code = ?
         AND ei.deleted_at IS NULL
       LIMIT 1`,
      [equipmentCode],
    );

    const equipment = items[0];

    if (!equipment) {
      return response.status(404).json({
        message: 'ไม่พบครุภัณฑ์',
      });
    }

    response.json({ equipment });
  } catch (error) {
    console.error('Get equipment error:', error);

    response.status(500).json({
      message: 'ไม่สามารถโหลดข้อมูลครุภัณฑ์ได้',
    });
  }
});

// POST /api/admin/equipment-items - เพิ่มข้อมูล 2 ตารางและ History ใน Transaction เดียว
adminEquipmentRouter.post('/', async (request, response) => {
  let connection;

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
    const receiveDate = request.body?.receive_date || null;
    const remark =
      String(request.body?.remark ?? '').trim() || null;
    const status = String(request.body?.status ?? 'available')
      .trim()
      .toLowerCase();
    const priceValue = request.body?.price;
    const price =
      priceValue == null || priceValue === ''
        ? null
        : Number(priceValue);
    const warrantyExpire =
      request.body?.warranty_expire || null;

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

    // ถ้าขั้นใดล้มเหลว rollback จะไม่ทิ้งข้อมูลสำเร็จเพียงครึ่งเดียว
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [equipmentResult] = await connection.execute(
      `INSERT INTO equipment (
        equipment_name,
        category_id,
        location_id,
        fiscal_year,
        description,
        receive_date,
        remark
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        equipmentName,
        categoryId,
        locationId,
        fiscalYear,
        description,
        receiveDate,
        remark,
      ],
    );

    const [itemResult] = await connection.execute(
      `INSERT INTO equipment_items (
        equipment_id,
        equipment_name,
        equipment_code,
        status,
        price,
        warranty_expire
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        equipmentResult.insertId,
        equipmentName,
        equipmentCode,
        status,
        price,
        warrantyExpire,
      ],
    );

    const createdEquipment = {
      item_id: itemResult.insertId,
      equipment_id: equipmentResult.insertId,
      equipment_name: equipmentName,
      equipment_code: equipmentCode,
      category_id: categoryId,
      location_id: locationId,
      fiscal_year: fiscalYear,
      description,
      receive_date: receiveDate,
      remark,
      status,
      price,
      warranty_expire: warrantyExpire,
    };

    await recordEquipmentHistory(connection, {
      itemId: itemResult.insertId,
      action: 'created',
      newData: createdEquipment,
      changedBy: Number(request.user.sub),
    });

    await connection.commit();

    response.status(201).json({
      message: 'เพิ่มครุภัณฑ์สำเร็จ',
      equipment: createdEquipment,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({
        message: 'รหัสครุภัณฑ์นี้ถูกใช้งานแล้ว',
      });
    }

    console.error('Create equipment error:', error);

    response.status(500).json({
      message: 'ไม่สามารถเพิ่มครุภัณฑ์ได้',
    });
  } finally {
    connection?.release();
  }
});

// GET /api/admin/equipment-items/deleted - รายการ Soft Delete สำหรับหน้า Restore
adminEquipmentRouter.get('/deleted', async (_request, response) => {
  try {
    const [equipmentItems] = await pool.query(
      `SELECT ${equipmentColumns}
       ${equipmentJoins}
       WHERE ei.deleted_at IS NOT NULL
       ORDER BY ei.deleted_at DESC`,
    );

    response.json({
      equipment: equipmentItems,
    });
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

    const [items] = await pool.execute(
      `SELECT item_id
       FROM equipment_items
       WHERE item_id = ?
       LIMIT 1`,
      [itemId],
    );

    if (!items[0]) {
      return response.status(404).json({
        message: 'ไม่พบครุภัณฑ์',
      });
    }

    const [history] = await pool.execute(
      `SELECT
        h.history_id,
        h.action,
        h.old_data,
        h.new_data,
        h.created_at,
        h.changed_by,
        u.name AS changed_by_name,
        u.email AS changed_by_email
      FROM equipment_history AS h
      LEFT JOIN users AS u
        ON h.changed_by = u.user_id
      WHERE h.item_id = ?
      ORDER BY h.history_id DESC`,
      [itemId],
    );

    response.json({ history });
  } catch (error) {
    console.error('Get equipment history error:', error);

    response.status(500).json({
      message: 'ไม่สามารถโหลดประวัติครุภัณฑ์ได้',
    });
  }
});

// PATCH /api/admin/equipment-items/:id/status - เปลี่ยนเฉพาะสถานะและบันทึก action แยก
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

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const currentEquipment = await findEquipmentByItemId(
      connection,
      itemId,
      { lock: true },
    );

    if (!currentEquipment) {
      await connection.rollback();

      return response.status(404).json({
        message: 'ไม่พบครุภัณฑ์',
      });
    }

    if (currentEquipment.status === status) {
      await connection.rollback();

      return response.json({
        message: 'ครุภัณฑ์อยู่ในสถานะนี้แล้ว',
        equipment: currentEquipment,
      });
    }

    await connection.execute(
      `UPDATE equipment_items
       SET status = ?
       WHERE item_id = ?`,
      [status, itemId],
    );

    const updatedEquipment = await findEquipmentByItemId(
      connection,
      itemId,
    );

    await recordEquipmentHistory(connection, {
      itemId,
      action: 'status_changed',
      oldData: currentEquipment,
      newData: updatedEquipment,
      changedBy: Number(request.user.sub),
    });

    await connection.commit();

    response.json({
      message: 'เปลี่ยนสถานะครุภัณฑ์สำเร็จ',
      equipment: updatedEquipment,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Update equipment status error:', error);

    response.status(500).json({
      message: 'ไม่สามารถเปลี่ยนสถานะครุภัณฑ์ได้',
    });
  } finally {
    connection?.release();
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

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const deletedEquipment = await findEquipmentByItemId(
      connection,
      itemId,
      { lock: true, includeDeleted: true },
    );

    if (!deletedEquipment) {
      await connection.rollback();

      return response.status(404).json({
        message: 'ไม่พบครุภัณฑ์',
      });
    }

    if (deletedEquipment.deleted_at === null) {
      await connection.rollback();

      return response.status(400).json({
        message: 'ครุภัณฑ์นี้ยังไม่ได้ถูกลบ',
      });
    }

    await connection.execute(
      `UPDATE equipment_items
       SET deleted_at = NULL
       WHERE item_id = ?`,
      [itemId],
    );

    const restoredEquipment = await findEquipmentByItemId(
      connection,
      itemId,
    );

    await recordEquipmentHistory(connection, {
      itemId,
      action: 'restored',
      oldData: deletedEquipment,
      newData: restoredEquipment,
      changedBy: Number(request.user.sub),
    });

    await connection.commit();

    response.json({
      message: 'กู้คืนครุภัณฑ์สำเร็จ',
      equipment: restoredEquipment,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Restore equipment error:', error);

    response.status(500).json({
      message: 'ไม่สามารถกู้คืนครุภัณฑ์ได้',
    });
  } finally {
    connection?.release();
  }
});

// DELETE /api/admin/equipment-items/:id - Soft Delete: เก็บแถวเดิมแต่ใส่ deleted_at
adminEquipmentRouter.delete('/:id', async (request, response) => {
  const itemId = Number(request.params.id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return response.status(400).json({
      message: 'รหัสครุภัณฑ์ไม่ถูกต้อง',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const currentEquipment = await findEquipmentByItemId(
      connection,
      itemId,
      { lock: true },
    );

    if (!currentEquipment) {
      await connection.rollback();

      return response.status(404).json({
        message: 'ไม่พบครุภัณฑ์',
      });
    }

    await connection.execute(
      `UPDATE equipment_items
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE item_id = ?`,
      [itemId],
    );

    const deletedEquipment = await findEquipmentByItemId(
      connection,
      itemId,
      { includeDeleted: true },
    );

    await recordEquipmentHistory(connection, {
      itemId,
      action: 'deleted',
      oldData: currentEquipment,
      newData: deletedEquipment,
      changedBy: Number(request.user.sub),
    });

    await connection.commit();

    response.json({
      message: 'ลบครุภัณฑ์สำเร็จ',
      equipment: deletedEquipment,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Delete equipment error:', error);

    response.status(500).json({
      message: 'ไม่สามารถลบครุภัณฑ์ได้',
    });
  } finally {
    connection?.release();
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

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const currentEquipment = await findEquipmentByItemId(
      connection,
      itemId,
      { lock: true },
    );

    if (!currentEquipment) {
      await connection.rollback();

      return response.status(404).json({
        message: 'ไม่พบครุภัณฑ์',
      });
    }

    // field ที่ไม่ได้ส่งมาจะใช้ค่าปัจจุบัน จึงรองรับการแก้เพียงบาง field
    const equipmentName = hasOwn(body, 'equipment_name')
      ? String(body.equipment_name ?? '').trim()
      : currentEquipment.equipment_name;
    const categoryId = hasOwn(body, 'category_id')
      ? Number(body.category_id)
      : currentEquipment.category_id;
    const locationId = hasOwn(body, 'location_id')
      ? body.location_id == null || body.location_id === ''
        ? null
        : Number(body.location_id)
      : currentEquipment.location_id;
    const fiscalYear = hasOwn(body, 'fiscal_year')
      ? body.fiscal_year == null || body.fiscal_year === ''
        ? null
        : Number(body.fiscal_year)
      : currentEquipment.fiscal_year;
    const description = hasOwn(body, 'description')
      ? String(body.description ?? '').trim() || null
      : currentEquipment.description;
    const receiveDate = hasOwn(body, 'receive_date')
      ? body.receive_date || null
      : currentEquipment.receive_date;
    const remark = hasOwn(body, 'remark')
      ? String(body.remark ?? '').trim() || null
      : currentEquipment.remark;
    const price = hasOwn(body, 'price')
      ? body.price == null || body.price === ''
        ? null
        : Number(body.price)
      : currentEquipment.price;
    const warrantyExpire = hasOwn(body, 'warranty_expire')
      ? body.warranty_expire || null
      : currentEquipment.warranty_expire;

    if (!equipmentName) {
      await connection.rollback();

      return response.status(400).json({
        message: 'กรุณากรอกชื่อครุภัณฑ์',
      });
    }

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      await connection.rollback();

      return response.status(400).json({
        message: 'หมวดหมู่ไม่ถูกต้อง',
      });
    }

    if (
      locationId !== null &&
      (!Number.isInteger(locationId) || locationId <= 0)
    ) {
      await connection.rollback();

      return response.status(400).json({
        message: 'สถานที่ไม่ถูกต้อง',
      });
    }

    if (
      fiscalYear !== null &&
      (!Number.isInteger(fiscalYear) ||
        fiscalYear < 1901 ||
        fiscalYear > 2155)
    ) {
      await connection.rollback();

      return response.status(400).json({
        message: 'ปีงบประมาณไม่ถูกต้อง',
      });
    }

    if (price !== null && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      await connection.rollback();

      return response.status(400).json({
        message: 'ราคาครุภัณฑ์ไม่ถูกต้อง',
      });
    }

    await connection.execute(
      `UPDATE equipment
       SET equipment_name = ?,
           category_id = ?,
           location_id = ?,
           fiscal_year = ?,
           description = ?,
           receive_date = ?,
           remark = ?
       WHERE equipment_id = ?`,
      [
        equipmentName,
        categoryId,
        locationId,
        fiscalYear,
        description,
        receiveDate,
        remark,
        currentEquipment.equipment_id,
      ],
    );

    await connection.execute(
      `UPDATE equipment_items
       SET equipment_name = ?,
           price = ?,
           warranty_expire = ?
       WHERE item_id = ?`,
      [equipmentName, price, warrantyExpire, itemId],
    );

    const updatedEquipment = await findEquipmentByItemId(
      connection,
      itemId,
    );

    await recordEquipmentHistory(connection, {
      itemId,
      action: 'updated',
      oldData: currentEquipment,
      newData: updatedEquipment,
      changedBy: Number(request.user.sub),
    });

    await connection.commit();

    response.json({
      message: 'แก้ไขครุภัณฑ์สำเร็จ',
      equipment: updatedEquipment,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return response.status(400).json({
        message: 'ไม่พบหมวดหมู่หรือสถานที่ที่เลือก',
      });
    }

    console.error('Update equipment error:', error);

    response.status(500).json({
      message: 'ไม่สามารถแก้ไขครุภัณฑ์ได้',
    });
  } finally {
    connection?.release();
  }
});

export { adminEquipmentRouter };
export default equipmentRouter;
