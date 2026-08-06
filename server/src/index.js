import 'dotenv/config.js';
import cors from 'cors';
import express from 'express';
import { pool } from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 64) {
  throw new Error('JWT_SECRET must contain at least 64 characters');
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());
function authenticate(request, response, next) {
  const authorization = String(request.headers.authorization ?? '');
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({
      message: 'กรุณาเข้าสู่ระบบ',
    });
  }

  try {
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'asset-management-api',
      audience: 'asset-management-client',
    });

    request.user = payload;
    next();
  } catch {
    return response.status(401).json({
      message: 'Token หมดอายุหรือไม่ถูกต้อง',
    });
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'asset-management-api' });
});

app.get('/api/db-check', async (_request, response) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        DATABASE() AS database_name,
        VERSION() AS version
    `);

    response.json({
      status: 'ok',
      database: rows[0],
    });
  } catch (error) {
    console.error('Database connection error:', error);

    response.status(500).json({
      status: 'error',
      message: 'Database connection failed',
    });
  }
});

app.post('/api/auth/register', async (request, response) => {
  try {
    
      const name = String(request.body.name ??'').trim();
      const email = String(request.body.email ??'').trim().toLowerCase();
      const password = String(request.body.password?? '');


    if (!name || !email || !password) {
      return response.status(400).json({message:'กรุณากรอกข้อมูลให้ครบ'});
    }

    if(password.length < 8){
      return response.status(400).json({message:'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร'});
    }

    const [existingUser] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',[email],
    );

    if (existingUser.length > 0) {
      return response.status(409).json({
        message:'อีเมลนี้ถูกใช้งานแล้ว'});
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash],
    );

    response.status(201).json({
      message:'ลงทะเบียนสำเร็จ',
      user: {
        user_id: result.insertId,
        name,
        email,
        role: 'user',
      },
    });



  } catch (error) {
    console.error('Registration error:', error);
    response.status(500).json({message:'ไม่สามารถสมัครสมาชิกได้'});
  }
});

app.post('/api/auth/login', async (request, response) => {
  try {
    const email = String(request.body.email ?? '').trim().toLowerCase();
    const password = String(request.body.password ?? '');

    if (!email || !password) {
      return response.status(400).json({message:'กรุณากรอกอีเมลและรหัสผ่าน'});
    }

const [users] = await pool.execute(
  `SELECT
    user_id,
    name,
    email,
    password_hash,
    role
  FROM users
  WHERE email = ?
  LIMIT 1`,
  [email],
);

    const user = users[0];

    if (!user) {
      return response.status(401).json({message:'อีเมลหรือรหัสผ่านไม่ถูกต้อง'});
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

if (!passwordMatch) {
  return response.status(401).json({
    message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  });
}

const token = jwt.sign(
  {
    role: user.role,
  },
  jwtSecret,
  {
    subject: String(user.user_id),
    expiresIn: '1h',
    issuer: 'asset-management-api',
    audience: 'asset-management-client',
  },
);

response.json({
  message: 'เข้าสู่ระบบสำเร็จ',
  token,
  user: {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
  },
});
  } catch (error) {
    console.error('Login error:', error);
    response.status(500).json({message:'ไม่สามารถเข้าสู่ระบบได้'});
  }
});

app.get('/api/auth/me', authenticate, async (request, response) => {
  try {
    const [users] = await pool.execute(
      `SELECT
        user_id,
        name,
        email,
        role,
        created_at
      FROM users
      WHERE user_id = ?
      LIMIT 1`,
      [request.user.sub],
    );

    const user = users[0];

    if (!user) {
      return response.status(401).json({
        message: 'ไม่พบบัญชีผู้ใช้',
      });
    }

    response.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);

    response.status(500).json({
      message: 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้',
    });
  }
});

async function requireAdmin(request, response, next) {
  try {
    const [users] = await pool.execute(
      `SELECT role
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [request.user.sub],
    );

    const user = users[0];

    if (!user) {
      return response.status(401).json({
        message: 'ไม่พบบัญชีผู้ใช้',
      });
    }

    if (user.role !== 'admin') {
      return response.status(403).json({
        message: 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้',
      });
    }

    next();
  } catch (error) {
    console.error('Authorization error:', error);

    response.status(500).json({
      message: 'ไม่สามารถตรวจสอบสิทธิ์ได้',
    });
  }
}

app.get(
  '/api/admin/users',
  authenticate,
  requireAdmin,
  async (_request, response) => {
    try {
      const [users] = await pool.query(
        `SELECT
          user_id,
          name,
          email,
          role,
          created_at
        FROM users
        ORDER BY created_at DESC`,
      );

      response.json({ users });
    } catch (error) {
      console.error('Get users error:', error);

      response.status(500).json({
        message: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้',
      });
    }
  },
);

app.patch(
  '/api/admin/users/:id/role',
  authenticate,
  requireAdmin,
  async (request, response) => {
    try {
      const userId = Number(request.params.id);
      const role = String(request.body?.role ?? '')
  .trim()
  .toLowerCase();

      if (!Number.isInteger(userId) || userId <= 0) {
        return response.status(400).json({
          message: 'รหัสผู้ใช้ไม่ถูกต้อง',
        });
      }

      if (!['admin', 'user'].includes(role)) {
        return response.status(400).json({
          message: 'Role ต้องเป็น admin หรือ user',
        });
      }

      if (
        String(request.user.sub) === String(userId) &&
        role !== 'admin'
      ) {
        return response.status(400).json({
          message: 'ไม่สามารถลดสิทธิ์บัญชีที่กำลังใช้งานได้',
        });
      }

      const [users] = await pool.execute(
        `SELECT user_id, name, email, role
         FROM users
         WHERE user_id = ?
         LIMIT 1`,
        [userId],
      );

      const user = users[0];

      if (!user) {
        return response.status(404).json({
          message: 'ไม่พบผู้ใช้',
        });
      }

      await pool.execute(
        `UPDATE users
         SET role = ?
         WHERE user_id = ?`,
        [role, userId],
      );

      response.json({
        message: 'อัปเดตสิทธิ์เรียบร้อยแล้ว',
        user: {
          ...user,
          role,
        },
      });
    } catch (error) {
      console.error('Update role error:', error);

      response.status(500).json({
        message: 'ไม่สามารถอัปเดตสิทธิ์ได้',
      });
    }
  },
);

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
