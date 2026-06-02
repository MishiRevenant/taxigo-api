"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const database_1 = require("../config/database");
const Trip_1 = require("../entities/Trip");
const auth_1 = require("../middleware/auth");
const socket_1 = require("../services/socket");
const typeorm_1 = require("typeorm");
const router = (0, express_1.Router)();
// All trip routes require authentication
router.use(auth_1.authenticate);
// Helper to sanitize a trip for API response
function serializeTrip(trip) {
    return {
        id: trip.id,
        passengerId: trip.passengerId,
        driverId: trip.driverId,
        passenger: trip.passenger
            ? { id: trip.passenger.id, name: trip.passenger.name, email: trip.passenger.email, role: trip.passenger.role, phone: trip.passenger.phone, rating: Number(trip.passenger.rating) }
            : undefined,
        driver: trip.driver
            ? { id: trip.driver.id, name: trip.driver.name, email: trip.driver.email, role: trip.driver.role, phone: trip.driver.phone, rating: Number(trip.driver.rating) }
            : undefined,
        originAddress: trip.originAddress,
        originLat: Number(trip.originLat),
        originLng: Number(trip.originLng),
        destinationAddress: trip.destinationAddress,
        destinationLat: Number(trip.destinationLat),
        destinationLng: Number(trip.destinationLng),
        status: trip.status,
        vehicleType: trip.vehicleType,
        notes: trip.notes,
        fare: trip.fare !== null ? Number(trip.fare) : null,
        distance: trip.distance !== null ? Number(trip.distance) : null,
        duration: trip.duration,
        requestedAt: trip.requestedAt?.toISOString(),
        acceptedAt: trip.acceptedAt?.toISOString() ?? null,
        startedAt: trip.startedAt?.toISOString() ?? null,
        completedAt: trip.completedAt?.toISOString() ?? null,
    };
}
// ── POST /api/trips ─────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/trips:
 *   post:
 *     tags: [Trips]
 *     summary: Solicitar un viaje (solo pasajero)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [originAddress, destinationAddress]
 *             properties:
 *               originAddress: { type: string, example: 'Calle 72 #10-07, Bogotá' }
 *               destinationAddress: { type: string, example: 'Aeropuerto El Dorado' }
 *               vehicleType: { type: string, enum: [standard, comfort, xl], default: standard }
 *               notes: { type: string, maxLength: 300 }
 *     responses:
 *       201:
 *         description: Viaje solicitado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Trip' }
 *       409:
 *         description: Ya tienes un viaje activo
 */
router.post('/', (0, auth_1.requireRole)('passenger'), async (req, res) => {
    const schema = zod_1.z.object({
        originAddress: zod_1.z.string().min(3),
        destinationAddress: zod_1.z.string().min(3),
        vehicleType: zod_1.z.enum(['standard', 'comfort', 'xl']).default('standard'),
        notes: zod_1.z.string().max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ message: 'Datos inválidos', errors: parsed.error.flatten() });
        return;
    }
    const { originAddress, destinationAddress, vehicleType, notes } = parsed.data;
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    try {
        const existing = await tripRepo.findOne({
            where: { passengerId: req.user.id, status: (0, typeorm_1.In)(['requested', 'accepted', 'on_ride']) },
        });
        if (existing) {
            res.status(409).json({ message: 'Ya tienes un viaje activo' });
            return;
        }
        const randomLat = () => 4.6097 + (Math.random() - 0.5) * 0.05;
        const randomLng = () => -74.0817 + (Math.random() - 0.5) * 0.05;
        const trip = tripRepo.create({
            id: (0, crypto_1.randomUUID)(),
            passengerId: req.user.id,
            originAddress,
            originLat: randomLat(),
            originLng: randomLng(),
            destinationAddress,
            destinationLat: randomLat(),
            destinationLng: randomLng(),
            vehicleType,
            notes: notes || null,
            status: 'requested',
        });
        await tripRepo.save(trip);
        // Load passenger relation for response
        const saved = await tripRepo.findOne({
            where: { id: trip.id },
            relations: ['passenger'],
        });
        const serialized = serializeTrip(saved);
        (0, socket_1.emitTripRequested)(serialized);
        res.status(201).json({ data: serialized });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── GET /api/trips/available ─────────────────────────────────────────────────
/**
 * @openapi
 * /api/trips/available:
 *   get:
 *     tags: [Trips]
 *     summary: Viajes disponibles para aceptar (solo conductor)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de viajes con status 'requested'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Trip' }
 */
router.get('/available', (0, auth_1.requireRole)('driver'), async (_req, res) => {
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    try {
        const trips = await tripRepo.find({
            where: { status: 'requested' },
            relations: ['passenger'],
            order: { requestedAt: 'DESC' },
        });
        res.json({ data: trips.map(serializeTrip) });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── GET /api/trips/active ────────────────────────────────────────────────────
/**
 * @openapi
 * /api/trips/active:
 *   get:
 *     tags: [Trips]
 *     summary: Viaje activo del usuario autenticado
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Viaje activo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Trip' }
 *       404:
 *         description: Sin viaje activo
 */
router.get('/active', async (req, res) => {
    const user = req.user;
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    const where = user.role === 'passenger'
        ? { passengerId: user.id, status: (0, typeorm_1.In)(['requested', 'accepted', 'on_ride']) }
        : { driverId: user.id, status: (0, typeorm_1.In)(['requested', 'accepted', 'on_ride']) };
    try {
        const trip = await tripRepo.findOne({
            where,
            relations: ['passenger', 'driver'],
            order: { requestedAt: 'DESC' },
        });
        if (!trip) {
            res.status(404).json({ message: 'No hay viaje activo' });
            return;
        }
        res.json({ data: serializeTrip(trip) });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── GET /api/trips/history ───────────────────────────────────────────────────
/**
 * @openapi
 * /api/trips/history:
 *   get:
 *     tags: [Trips]
 *     summary: Historial de viajes del usuario
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de viajes completados o cancelados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Trip' }
 */
router.get('/history', async (req, res) => {
    const user = req.user;
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    const where = user.role === 'passenger'
        ? { passengerId: user.id, status: (0, typeorm_1.In)(['completed', 'cancelled']) }
        : { driverId: user.id, status: (0, typeorm_1.In)(['completed', 'cancelled']) };
    try {
        const trips = await tripRepo.find({
            where,
            relations: ['passenger', 'driver'],
            order: { requestedAt: 'DESC' },
        });
        res.json({ data: trips.map(serializeTrip) });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── POST /api/trips/:id/accept ───────────────────────────────────────────────
/**
 * @openapi
 * /api/trips/{id}/accept:
 *   post:
 *     tags: [Trips]
 *     summary: Conductor acepta un viaje
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Viaje aceptado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Trip' }
 *       404:
 *         description: Viaje no encontrado
 *       409:
 *         description: El viaje ya no está disponible
 */
router.post('/:id/accept', (0, auth_1.requireRole)('driver'), async (req, res) => {
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    try {
        const trip = await tripRepo.findOne({ where: { id: req.params.id } });
        if (!trip) {
            res.status(404).json({ message: 'Viaje no encontrado' });
            return;
        }
        if (trip.status !== 'requested') {
            res.status(409).json({ message: 'El viaje ya no está disponible' });
            return;
        }
        trip.driverId = req.user.id;
        trip.status = 'accepted';
        trip.fare = Math.floor(15000 + Math.random() * 30000);
        trip.distance = Math.round((5 + Math.random() * 20) * 10) / 10;
        trip.acceptedAt = new Date();
        await tripRepo.save(trip);
        const updated = await tripRepo.findOne({
            where: { id: trip.id },
            relations: ['passenger', 'driver'],
        });
        const serialized = serializeTrip(updated);
        (0, socket_1.emitTripAccepted)(updated.passengerId, serialized);
        res.json({ data: serialized });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── POST /api/trips/:id/start ────────────────────────────────────────────────
/**
 * @openapi
 * /api/trips/{id}/start:
 *   post:
 *     tags: [Trips]
 *     summary: Conductor inicia el viaje (accepted → on_ride)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Viaje iniciado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Trip' }
 */
router.post('/:id/start', (0, auth_1.requireRole)('driver'), async (req, res) => {
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    try {
        const trip = await tripRepo.findOne({ where: { id: req.params.id } });
        if (!trip) {
            res.status(404).json({ message: 'Viaje no encontrado' });
            return;
        }
        if (trip.status !== 'accepted') {
            res.status(409).json({ message: `No se puede iniciar un viaje en estado ${trip.status}` });
            return;
        }
        if (trip.driverId !== req.user.id) {
            res.status(403).json({ message: 'No eres el conductor de este viaje' });
            return;
        }
        trip.status = 'on_ride';
        trip.startedAt = new Date();
        await tripRepo.save(trip);
        const updated = await tripRepo.findOne({ where: { id: trip.id }, relations: ['passenger', 'driver'] });
        const serialized = serializeTrip(updated);
        (0, socket_1.emitTripStatusUpdated)(updated.passengerId, updated.driverId, serialized, 'trip:started');
        res.json({ data: serialized });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── POST /api/trips/:id/complete ─────────────────────────────────────────────
/**
 * @openapi
 * /api/trips/{id}/complete:
 *   post:
 *     tags: [Trips]
 *     summary: Conductor finaliza el viaje (on_ride → completed)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Viaje completado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Trip' }
 */
router.post('/:id/complete', (0, auth_1.requireRole)('driver'), async (req, res) => {
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    try {
        const trip = await tripRepo.findOne({ where: { id: req.params.id } });
        if (!trip) {
            res.status(404).json({ message: 'Viaje no encontrado' });
            return;
        }
        if (trip.status !== 'on_ride') {
            res.status(409).json({ message: `No se puede completar un viaje en estado ${trip.status}` });
            return;
        }
        if (trip.driverId !== req.user.id) {
            res.status(403).json({ message: 'No eres el conductor de este viaje' });
            return;
        }
        trip.status = 'completed';
        trip.completedAt = new Date();
        trip.duration = Math.floor(15 + Math.random() * 40);
        await tripRepo.save(trip);
        const updated = await tripRepo.findOne({ where: { id: trip.id }, relations: ['passenger', 'driver'] });
        const serialized = serializeTrip(updated);
        (0, socket_1.emitTripStatusUpdated)(updated.passengerId, updated.driverId, serialized, 'trip:completed');
        res.json({ data: serialized });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── POST /api/trips/:id/cancel ───────────────────────────────────────────────
/**
 * @openapi
 * /api/trips/{id}/cancel:
 *   post:
 *     tags: [Trips]
 *     summary: Cancelar un viaje (pasajero o conductor)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Viaje cancelado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Trip' }
 *       403:
 *         description: Sin permisos para cancelar este viaje
 */
router.post('/:id/cancel', async (req, res) => {
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    try {
        const trip = await tripRepo.findOne({ where: { id: req.params.id } });
        if (!trip) {
            res.status(404).json({ message: 'Viaje no encontrado' });
            return;
        }
        const userId = req.user.id;
        const isPassenger = trip.passengerId === userId;
        const isDriver = trip.driverId === userId;
        if (!isPassenger && !isDriver) {
            res.status(403).json({ message: 'Sin permisos para cancelar este viaje' });
            return;
        }
        if (['completed', 'cancelled'].includes(trip.status)) {
            res.status(409).json({ message: `El viaje ya está ${trip.status}` });
            return;
        }
        trip.status = 'cancelled';
        await tripRepo.save(trip);
        const updated = await tripRepo.findOne({ where: { id: trip.id }, relations: ['passenger', 'driver'] });
        const serialized = serializeTrip(updated);
        (0, socket_1.emitTripStatusUpdated)(updated.passengerId, updated.driverId, serialized, 'trip:cancelled');
        res.json({ data: serialized });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── PATCH /api/trips/:id/status (legacy endpoint) ───────────────────────────
/**
 * @openapi
 * /api/trips/{id}/status:
 *   patch:
 *     tags: [Trips]
 *     summary: Actualizar estado de un viaje (endpoint genérico)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [on_ride, completed, cancelled] }
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/:id/status', async (req, res) => {
    const schema = zod_1.z.object({ status: zod_1.z.enum(['on_ride', 'completed', 'cancelled']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ message: 'Estado inválido' });
        return;
    }
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    try {
        const trip = await tripRepo.findOne({ where: { id: req.params.id } });
        if (!trip) {
            res.status(404).json({ message: 'Viaje no encontrado' });
            return;
        }
        trip.status = parsed.data.status;
        if (parsed.data.status === 'on_ride')
            trip.startedAt = new Date();
        if (parsed.data.status === 'completed') {
            trip.completedAt = new Date();
            trip.duration = Math.floor(15 + Math.random() * 40);
        }
        await tripRepo.save(trip);
        const updated = await tripRepo.findOne({ where: { id: trip.id }, relations: ['passenger', 'driver'] });
        const serialized = serializeTrip(updated);
        (0, socket_1.emitTripStatusUpdated)(updated.passengerId, updated.driverId, serialized, 'trip:updated');
        res.json({ data: serialized });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── GET /api/trips/:id ───────────────────────────────────────────────────────
/**
 * @openapi
 * /api/trips/{id}:
 *   get:
 *     tags: [Trips]
 *     summary: Obtener un viaje por ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Datos del viaje
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Trip' }
 *       404:
 *         description: Viaje no encontrado
 */
router.get('/:id', async (req, res) => {
    const tripRepo = database_1.AppDataSource.getRepository(Trip_1.Trip);
    try {
        const trip = await tripRepo.findOne({
            where: { id: req.params.id },
            relations: ['passenger', 'driver'],
        });
        if (!trip) {
            res.status(404).json({ message: 'Viaje no encontrado' });
            return;
        }
        res.json({ data: serializeTrip(trip) });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
exports.default = router;
