// แปลงข้อความแม่แบบที่ Admin เขียน ({{ตัวแปร}}) เป็นอีเมลจริงทั้งแบบข้อความล้วนและ HTML จากข้อมูลชุดเดียวกัน
// ใช้ทั้งตอนส่งจริง ดูตัวอย่าง และส่งอีเมลทดสอบ ตัวอย่างที่เห็นในหน้าตั้งค่าจึงตรงกับอีเมลที่ส่งจริงเสมอ
//
// กติกา: เนื้อความแบ่งเป็นย่อหน้าด้วยบรรทัดว่าง ย่อหน้าที่ว่างหลังแทนค่า (เช่น {{closing}} ตอนผ่าน) จะถูกตัดทิ้ง
// ข้อความที่มาจากผู้ใช้ทุกตัว (ชื่อ หมายเหตุ ชื่อไฟล์) และข้อความที่ Admin พิมพ์เอง ผ่าน escapeHtml ก่อนเข้า HTML เสมอ
import { escapeHtml } from '../../utils/mailer.js';

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;
// ย่อหน้าที่มีแต่ตัวแปรพิเศษตัวเดียว (ปุ่มลิงก์ / รายละเอียด) ใช้จัดรูปแบบเป็นบล็อกเต็มตัว
const BLOCK_ONLY = /^\{\{\s*([a-z_]+)\s*\}\}$/;

const buttonStyle =
  'display:inline-block;padding:12px 20px;border-radius:8px;background:#ed0082;color:#ffffff;text-decoration:none;font-weight:700';

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 5000;

function placeholderKeys(text) {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

// คืนข้อความ error ภาษาไทย หรือ null ถ้าแม่แบบใช้ได้
export function validateTemplate(event, { subject, body }) {
  const allowed = new Map(event.variables.map((variable) => [variable.key, variable]));

  for (const key of placeholderKeys(`${subject}\n${body}`)) {
    if (!allowed.has(key)) return `ไม่รู้จักตัวแปร {{${key}}} ในเหตุการณ์นี้`;
  }
  for (const key of placeholderKeys(subject)) {
    if (allowed.get(key).block) return `หัวเรื่องใช้ {{${key}}} ไม่ได้ ใช้ได้เฉพาะในเนื้อความ`;
  }
  for (const key of event.requiredVariables ?? []) {
    if (!placeholderKeys(body).includes(key)) {
      return `เนื้อความต้องมี {{${key}}} ไม่งั้นอีเมลจะใช้งานไม่ได้`;
    }
  }
  return null;
}

// values = { ชื่อตัวแปร: ข้อความ } สำหรับตัวแปรทั่วไป, rows = [[หัวข้อ, ค่า], ...] สำหรับ {{details}}, link = URL เต็ม
export function renderEmail(event, { subject, body }, { values, rows = [], link }) {
  const valueOf = (key) => String(values[key] ?? '');
  const rowsText = rows.map(([label, value]) => `${label}: ${value}`);
  const rowsHtml = rows
    .map(([label, value]) => `${escapeHtml(label)}: <strong>${escapeHtml(value)}</strong>`)
    .join('<br>');

  // หัวเรื่องเป็นบรรทัดเดียวเสมอ ตัวแปรพิเศษถูกกันไว้ตอน validate แล้ว
  const renderedSubject = subject
    .replace(PLACEHOLDER, (_match, key) => valueOf(key))
    .replace(/\s+/g, ' ')
    .trim();

  const textBlocks = [];
  const htmlBlocks = [];

  for (const rawBlock of body.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const block = rawBlock.trim();
    if (!block) continue;

    const only = BLOCK_ONLY.exec(block)?.[1];

    if (only === 'details') {
      if (rows.length === 0) continue;
      textBlocks.push(rowsText.join('\n'));
      htmlBlocks.push(`<p>${rowsHtml}</p>`);
      continue;
    }

    if (only === 'link') {
      textBlocks.push(`${event.linkLabel}:\n${link}`);
      htmlBlocks.push(
        `<p><a href="${escapeHtml(link)}" style="${buttonStyle}">${escapeHtml(event.linkLabel)}</a></p>`,
      );
      if (event.showRawLink) {
        htmlBlocks.push(`<p>หรือคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br>${escapeHtml(link)}</p>`);
      }
      continue;
    }

    // ย่อหน้าทั่วไป: แทนค่าในข้อความล้วนก่อน ถ้าว่างเปล่า (เช่น {{closing}} ตอนผ่าน) ทิ้งทั้งย่อหน้า
    const text = block.replace(PLACEHOLDER, (_match, key) => {
      if (key === 'details') return rowsText.join('\n');
      if (key === 'link') return link;
      return valueOf(key);
    });
    if (!text.trim()) continue;

    const html = escapeHtml(block)
      .replace(PLACEHOLDER, (_match, key) => {
        if (key === 'details') return rowsHtml;
        if (key === 'link') return `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`;
        return escapeHtml(valueOf(key));
      })
      .replace(/\n/g, '<br>');

    textBlocks.push(text);
    htmlBlocks.push(`<p>${html}</p>`);
  }

  return {
    subject: renderedSubject,
    text: textBlocks.join('\n\n'),
    html: htmlBlocks.join('\n'),
  };
}
