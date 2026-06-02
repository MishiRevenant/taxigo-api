"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const database_1 = require("../config/database");
const User_1 = require("../entities/User");
const jwt_1 = require("../services/jwt");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ── POST /api/auth/register ──────────────────────────────────────────────────
/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string, minLength: 2, example: Carlos Méndez }
 *               email: { type: string, format: email, example: carlos@ejemplo.com }
 *               password: { type: string, minLength: 6, example: secreto123 }
 *               role: { type: string, enum: [passenger, driver] }
 *               phone: { type: string, example: '+57 300 123 4567' }
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 *                     tokens: { $ref: '#/components/schemas/AuthTokens' }
 *       409:
 *         description: El email ya está registrado
 *       422:
 *         description: Datos inválidos
 */
router.post('/register', async (req, res) => {
    const schema = zod_1.z.object({
        name: zod_1.z.string().min(2).max(80),
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(6),
        role: zod_1.z.enum(['passenger', 'driver']),
        phone: zod_1.z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ message: 'Datos inválidos', errors: parsed.error.flatten() });
        return;
    }
    const { name, email, password, role, phone } = parsed.data;
    const userRepo = database_1.AppDataSource.getRepository(User_1.User);
    try {
        const existing = await userRepo.findOne({ where: { email } });
        if (existing) {
            res.status(409).json({ message: 'El email ya está registrado' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = userRepo.create({
            id: (0, crypto_1.randomUUID)(),
            name,
            email,
            password: hashedPassword,
            role,
            phone: phone || null,
            rating: 5.0,
        });
        await userRepo.save(user);
        const tokens = await (0, jwt_1.generateTokens)(user);
        const { password: _pw, ...safeUser } = user;
        res.status(201).json({ data: { user: safeUser, tokens } });
    }
    catch (err) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});
// ── POST /api/auth/login ─────────────────────────────────────────────────────
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: passenger@taxigo.com }
 *               password: { type: string, example: password }
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 *                     tokens: { $ref: '#/components/schemas/AuthTokens' }
 *       401:
 *         description: Credenciales incorrectas
 */
router.post('/login', async (req, res) => {
    const schema = zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ message: 'Datos inválidos' });
        return;
    }
    const { email, password } = parsed.data;
    const userRepo = database_1.AppDataSource.getRepository(User_1.User);
    try {
        const user = await userRepo
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('user.email = :email', { email })
            .getOne();
        if (!user) {
            res.status(401).json({ message: 'Credenciales incorrectas' });
            return;
        }
        const match = await bcryptjs_1.default.compare(password, user.password);
        if (!match) {
            res.status(401).json({ message: 'Credenciales incorrectas' });
            return;
        }
        const tokens = await (0, jwt_1.generateTokens)(user);
        const { password: _pw, ...safeUser } = user;
        res.json({ data: { user: safeUser, tokens } });
    }
    catch (err) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});
// ── GET /api/auth/me ─────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obtener perfil del usuario autenticado
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: No autorizado
 */
router.get('/me', auth_1.authenticate, (req, res) => {
    res.json({ data: { user: req.user } });
});
// ── POST /api/auth/logout ────────────────────────────────────────────────────
/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión (revocar refresh token)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Sesión cerrada
 */
router.post('/logout', auth_1.authenticate, async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            await (0, jwt_1.revokeRefreshToken)(refreshToken);
        }
        catch { /* ignore */ }
    }
    res.json({ message: 'Sesión cerrada' });
});
// ── POST /api/auth/refresh ───────────────────────────────────────────────────
/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renovar access token usando refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Nuevos tokens generados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/AuthTokens' }
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken requerido' });
        return;
    }
    try {
        const payload = await (0, jwt_1.verifyRefreshToken)(refreshToken);
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        const user = await userRepo.findOne({ where: { id: payload.sub } });
        if (!user) {
            res.status(401).json({ message: 'Usuario no encontrado' });
            return;
        }
        await (0, jwt_1.revokeRefreshToken)(refreshToken);
        const tokens = await (0, jwt_1.generateTokens)(user);
        res.json({ data: tokens });
    }
    catch {
        res.status(401).json({ message: 'Refresh token inválido o expirado' });
    }
});
exports.default = router;
