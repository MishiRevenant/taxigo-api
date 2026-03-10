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
    try {
        const { rows: existingRows } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingRows.length > 0) {
            res.status(409).json({ message: 'El email ya está registrado' });
            return;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = randomUUID();
        const createdAt = new Date().toISOString();
        await db.query(`
            INSERT INTO users (id, name, email, password, role, phone, rating, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 5.0, current_timestamp)
        `, [id, name, email, hashedPassword, role, phone || null]);
        const user = {
            id, name, email, role,
            phone: phone || undefined,
            rating: 5.0,
            createdAt,
        };
        const tokens = await generateTokens(user);
        res.status(201).json({ data: { user, tokens } });
    }
    catch (err) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
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
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const row = rows[0];
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
            rating: Number(user.rating),
            createdAt: user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString(),
        };
        const tokens = await generateTokens(normalizedUser);
        res.json({ data: { user: normalizedUser, tokens } });
    }
    catch (err) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});
// ── POST /api/auth/logout ──────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            await revokeRefreshToken(refreshToken);
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
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken requerido' });
        return;
    }
    try {
        const payload = await verifyRefreshToken(refreshToken);
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [payload.sub]);
        const row = rows[0];
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
            rating: Number(row.rating),
            createdAt: new Date(row.created_at).toISOString(),
        };
        // Rotate tokens
        await revokeRefreshToken(refreshToken);
        const tokens = await generateTokens(user);
        res.json({ data: tokens });
    }
    catch {
        res.status(401).json({ message: 'Refresh token inválido o expirado' });
    }
});
export default router;
