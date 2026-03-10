import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db } from '../db/init.js';
import { generateTokens, verifyRefreshToken, revokeRefreshToken } from '../services/jwt.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
// ── POST /api/auth/register ────────────────────────────────
router.post('/register', async (req, res) => {
    const schema = z.object({
        name: z.string().min(2).max(80),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(['passenger', 'driver']),
        phone: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ message: 'Datos inválidos', errors: parsed.error.flatten() });
        return;
    }
    const { name, email, password, role, phone } = parsed.data;
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        res.status(409).json({ message: 'El email ya está registrado' });
        return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(`
    INSERT INTO users (id, name, email, password, role, phone, rating, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 5.0, ?)
  `).run(id, name, email, hashedPassword, role, phone || null, createdAt);
    const user = {
        id, name, email, role,
        phone: phone || undefined,
        rating: 5.0,
        createdAt,
    };
    const tokens = generateTokens(user);
    res.status(201).json({ data: { user, tokens } });
});
// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', async (req, res) => {
    const schema = z.object({
        email: z.string().email(),
        password: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ message: 'Datos inválidos' });
        return;
    }
    const { email, password } = parsed.data;
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row) {
        res.status(401).json({ message: 'Credenciales incorrectas' });
        return;
    }
    const match = await bcrypt.compare(password, row.password);
    if (!match) {
        res.status(401).json({ message: 'Credenciales incorrectas' });
        return;
    }
    const { password: _pw, ...user } = row;
    // Map snake_case from DB to camelCase
    const normalizedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        rating: user.rating,
        createdAt: user.created_at,
    };
    const tokens = generateTokens(normalizedUser);
    res.json({ data: { user: normalizedUser, tokens } });
});
// ── POST /api/auth/logout ──────────────────────────────────
router.post('/logout', authenticate, (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            revokeRefreshToken(refreshToken);
        }
        catch { /* ignore */ }
    }
    res.json({ message: 'Sesión cerrada' });
});
// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
    res.json({ data: { user: req.user } });
});
// ── POST /api/auth/refresh ─────────────────────────────────
router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken requerido' });
        return;
    }
    try {
        const payload = verifyRefreshToken(refreshToken);
        const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
        if (!row) {
            res.status(401).json({ message: 'Usuario no encontrado' });
            return;
        }
        const user = {
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
            phone: row.phone,
            rating: row.rating,
            createdAt: row.created_at,
        };
        // Rotate tokens
        revokeRefreshToken(refreshToken);
        const tokens = generateTokens(user);
        res.json({ data: tokens });
    }
    catch {
        res.status(401).json({ message: 'Refresh token inválido o expirado' });
    }
});
export default router;
