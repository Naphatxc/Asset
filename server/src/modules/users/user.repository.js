// Data Access Layer สำหรับตาราง users — ซ่อนรายละเอียด Prisma จาก Service/Middleware
// ใช้ร่วมกันโดย modules/auth (register/login/me) และ middlewares/auth.middleware.js (requireAdmin)
import { prisma } from '../../config/prisma.js';

export async function findByEmail(email, client = prisma) {
  return client.users.findUnique({
    where: { email },
    select: {
      user_id: true,
      name: true,
      email: true,
      password_hash: true,
      role: true,
      password_changed_at: true,
    },
  });
}

export async function findById(id, client = prisma) {
  return client.users.findUnique({
    where: { user_id: id },
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      created_at: true,
    },
  });
}

// ข้อมูลที่ authenticate ต้องเช็คทุก request: บัญชียังอยู่ไหม, session นี้เก่ากว่าตอนเปลี่ยนรหัสไหม
// และ role ล่าสุด (requireAdmin ใช้ต่อจากตรงนี้ ไม่ต้อง query ซ้ำ)
export async function findSessionState(id, client = prisma) {
  return client.users.findUnique({
    where: { user_id: id },
    select: { role: true, password_changed_at: true },
  });
}

export async function findPasswordHashById(id, client = prisma) {
  return client.users.findUnique({
    where: { user_id: id },
    select: { password_hash: true },
  });
}

// password_changed_at ทำให้ session ทุกอันที่ login ก่อนหน้านี้ใช้ไม่ได้ทันที (ดู auth.middleware.js)
// changedAt ต้องเป็นวินาทีเต็ม (ไม่มีเศษ ms) กัน MySQL ปัดขึ้น — ผู้เรียกใช้ currentSecond() จาก utils/access-token.js
export async function updatePassword(id, { passwordHash, changedAt }, client = prisma) {
  return client.users.update({
    where: { user_id: id },
    data: {
      password_hash: passwordHash,
      password_changed_at: changedAt,
    },
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

export async function findRoleById(id, client = prisma) {
  return client.users.findUnique({
    where: { user_id: id },
    select: { role: true },
  });
}

export async function findMany(client = prisma) {
  return client.users.findMany({
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function create(data, client = prisma) {
  return client.users.create({
    data,
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

export async function updateRole(id, role, client = prisma) {
  return client.users.update({
    where: { user_id: id },
    data: { role },
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

export async function count(client = prisma) {
  return client.users.count();
}

export async function remove(id, client = prisma) {
  return client.users.delete({
    where: { user_id: id },
    select: { user_id: true },
  });
}
