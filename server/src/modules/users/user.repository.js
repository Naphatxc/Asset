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
