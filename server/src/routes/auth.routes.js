// Routes เกี่ยวกับบัญชี: สมัครสมาชิก, Login และอ่านข้อมูลคนที่ Login อยู่
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';

import { jwtSecret } from '../config.js';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (request, response) => {
  try {
    const name = String(request.body?.name ?? '').trim();
    const email = String(request.body?.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(request.body?.password ?? '');

    if (name.length < 2 || name.length > 100) {
      return response.status(400).json({
        message: 'ชื่อต้องมีความยาว 2-100 ตัวอักษร',
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return response.status(400).json({
        message: 'รูปแบบอีเมลไม่ถูกต้อง',
      });
    }

    if (password.length < 8 || password.length > 72) {
      return response.status(400).json({
        message: 'รหัสผ่านต้องมีความยาว 8-72 ตัวอักษร',
      });
    }

    const [existingUsers] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    if (existingUsers.length > 0) {
      return response.status(409).json({
        message: 'อีเมลนี้ถูกใช้งานแล้ว',
      });
    }

    // ฐานข้อมูลเก็บ hash เท่านั้น ไม่เก็บรหัสผ่านจริง
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash],
    );

    response.status(201).json({
      message: 'ลงทะเบียนสำเร็จ',
      user: {
        user_id: result.insertId,
        name,
        email,
        role: 'user',
      },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({
        message: 'อีเมลนี้ถูกใช้งานแล้ว',
      });
    }

    console.error('Registration error:', error);

    response.status(500).json({
      message: 'ไม่สามารถสมัครสมาชิกได้',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (request, response) => {
  try {
    const email = String(request.body?.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(request.body?.password ?? '');

    if (!email || !password) {
      return response.status(400).json({
        message: 'กรุณากรอกอีเมลและรหัสผ่าน',
      });
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
      return response.status(401).json({
        message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!passwordMatch) {
      return response.status(401).json({
        message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    // Token อายุ 1 ชั่วโมง โดย subject (sub) คือ user_id
    const token = jwt.sign(
      { role: user.role },
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

    response.status(500).json({
      message: 'ไม่สามารถเข้าสู่ระบบได้',
    });
  }
});

// GET /api/auth/me ใช้ตรวจ Session ตอน Refresh หน้าเว็บ
router.get('/me', authenticate, async (request, response) => {
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

export default router;
