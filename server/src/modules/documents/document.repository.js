// Data Access Layer สำหรับ document_submissions — ทุกฟังก์ชันรับ Prisma transaction client ได้ (default = prisma)
import { prisma } from '../../config/prisma.js';

// users = ผู้ส่ง, reviewer = Admin ที่ตรวจ (null ถ้ายังไม่ได้ตรวจ หรือเป็น OBE ที่ไม่มีขั้นตอนตรวจ)
const submissionInclude = {
  users: { select: { name: true, email: true } },
  reviewer: { select: { name: true } },
};

// ใหม่สุดก่อน — userId ไม่ส่ง = ของทุกคน (หน้า Admin), docType ไม่ส่ง = ทุกประเภท
export async function findMany({ userId, docType } = {}, client = prisma) {
  return client.document_submissions.findMany({
    where: {
      ...(userId ? { user_id: userId } : {}),
      ...(docType ? { doc_type: docType } : {}),
    },
    include: submissionInclude,
    orderBy: { submission_id: 'desc' },
  });
}

export async function findById(submissionId, client = prisma) {
  return client.document_submissions.findUnique({
    where: { submission_id: submissionId },
    include: submissionInclude,
  });
}

export async function create(data, client = prisma) {
  return client.document_submissions.create({ data, include: submissionInclude });
}

export async function update(submissionId, data, client = prisma) {
  return client.document_submissions.update({
    where: { submission_id: submissionId },
    data,
    include: submissionInclude,
  });
}

// ===== ชื่อที่แสดงของประเภทเอกสาร (document_types มีครบ 3 แถวเสมอ ใส่ไว้ใน migration) =====
export async function findTypes(client = prisma) {
  return client.document_types.findMany();
}

export async function findType(docType, client = prisma) {
  return client.document_types.findUnique({ where: { doc_type: docType } });
}

export async function updateType(docType, { label, title }, client = prisma) {
  return client.document_types.update({ where: { doc_type: docType }, data: { label, title } });
}
