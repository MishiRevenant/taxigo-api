/**
 * Alias routes for academic compliance.
 * Maps /api/travels/* and /api/me/* to the trips business logic.
 * This keeps the codebase DRY while satisfying the required endpoint naming.
 */
import { Router } from 'express'
import { AppDataSource } from '../config/database'
import { Trip } from '../entities/Trip'
import { authenticate, requireRole } from '../middleware/auth'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { In } from 'typeorm'
import { emitTripRequested, emitTripAccepted, emitTripStatusUpdated } from '../services/socket'

const router = Router()
router.use(authenticate)

// ── Shared serialize helper (duplicated to keep routes self-contained) ────────
function serializeTrip(trip: Trip) {
    return {
        id: trip.id,
        passengerId: trip.passengerId,
        driverId: trip.driverId,
        passenger: trip.passenger ? { id: trip.passenger.id, name: trip.passenger.name, email: trip.passenger.email, role: trip.passenger.role, rating: Number(trip.passenger.rating) } : undefined,
        driver: trip.driver ? { id: trip.driver.id, name: trip.driver.name, email: trip.driver.email, role: trip.driver.role, rating: Number(trip.driver.rating) } : undefined,
        originAddress: trip.originAddress,
        destinationAddress: trip.destinationAddress,
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
    }
}

// ── POST /api/travels/request ─────────────────────────────────────────────────
/**
 * @openapi
 * /api/travels/request:
 *   post:
 *     tags: [Trips]
 *     summary: "[Alias] Pasajero solicita un viaje"
 *     description: "Alias de POST /api/trips — mismo comportamiento."
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
 *               vehicleType: { type: string, enum: [standard, comfort, xl] }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Viaje solicitado
 */
router.post('/request', requireRole('passenger'), async (req, res) => {
    const schema = z.object({
        originAddress: z.string().min(3),
        destinationAddress: z.string().min(3),
        vehicleType: z.enum(['standard', 'comfort', 'xl']).default('standard'),
        notes: z.string().max(300).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) { res.status(422).json({ message: 'Datos inválidos', errors: parsed.error.flatten() }); return }

    const { originAddress, destinationAddress, vehicleType, notes } = parsed.data
    const tripRepo = AppDataSource.getRepository(Trip)

    const existing = await tripRepo.findOne({
        where: { passengerId: req.user!.id, status: In(['requested', 'accepted', 'on_ride']) },
    })
    if (existing) { res.status(409).json({ message: 'Ya tienes un viaje activo' }); return }

    const rnd = (base: number) => base + (Math.random() - 0.5) * 0.05
    const trip = tripRepo.create({
        id: randomUUID(), passengerId: req.user!.id,
        originAddress, originLat: rnd(4.6097), originLng: rnd(-74.0817),
        destinationAddress, destinationLat: rnd(4.6097), destinationLng: rnd(-74.0817),
        vehicleType, notes: notes || null, status: 'requested',
    })
    await tripRepo.save(trip)
    const saved = await tripRepo.findOne({ where: { id: trip.id }, relations: ['passenger'] })!
    const serialized = serializeTrip(saved!)
    emitTripRequested(serialized)
    res.status(201).json({ data: serialized })
})

// ── POST /api/travels/:id/accept ──────────────────────────────────────────────
/**
 * @openapi
 * /api/travels/{id}/accept:
 *   post:
 *     tags: [Trips]
 *     summary: "[Alias] Conductor acepta el viaje"
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
 */
router.post('/:id/accept', requireRole('driver'), async (req, res) => {
    const tripRepo = AppDataSource.getRepository(Trip)
    const trip = await tripRepo.findOne({ where: { id: req.params.id } })
    if (!trip) { res.status(404).json({ message: 'Viaje no encontrado' }); return }
    if (trip.status !== 'requested') { res.status(409).json({ message: 'El viaje ya no está disponible' }); return }

    trip.driverId = req.user!.id
    trip.status = 'accepted'
    trip.fare = Math.floor(15000 + Math.random() * 30000)
    trip.distance = Math.round((5 + Math.random() * 20) * 10) / 10
    trip.acceptedAt = new Date()
    await tripRepo.save(trip)

    const updated = await tripRepo.findOne({ where: { id: trip.id }, relations: ['passenger', 'driver'] })!
    const serialized = serializeTrip(updated!)
    emitTripAccepted(updated!.passengerId, serialized)
    res.json({ data: serialized })
})

// ── POST /api/travels/:id/start ───────────────────────────────────────────────
/**
 * @openapi
 * /api/travels/{id}/start:
 *   post:
 *     tags: [Trips]
 *     summary: "[Alias] Conductor inicia el viaje"
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
 */
router.post('/:id/start', requireRole('driver'), async (req, res) => {
    const tripRepo = AppDataSource.getRepository(Trip)
    const trip = await tripRepo.findOne({ where: { id: req.params.id } })
    if (!trip) { res.status(404).json({ message: 'Viaje no encontrado' }); return }
    if (trip.status !== 'accepted') { res.status(409).json({ message: 'El viaje debe estar en estado accepted' }); return }

    trip.status = 'on_ride'
    trip.startedAt = new Date()
    await tripRepo.save(trip)

    const updated = await tripRepo.findOne({ where: { id: trip.id }, relations: ['passenger', 'driver'] })!
    const serialized = serializeTrip(updated!)
    emitTripStatusUpdated(updated!.passengerId, updated!.driverId, serialized, 'trip:started')
    res.json({ data: serialized })
})

// ── POST /api/travels/:id/complete ────────────────────────────────────────────
/**
 * @openapi
 * /api/travels/{id}/complete:
 *   post:
 *     tags: [Trips]
 *     summary: "[Alias] Conductor finaliza el viaje"
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
 */
router.post('/:id/complete', requireRole('driver'), async (req, res) => {
    const tripRepo = AppDataSource.getRepository(Trip)
    const trip = await tripRepo.findOne({ where: { id: req.params.id } })
    if (!trip) { res.status(404).json({ message: 'Viaje no encontrado' }); return }
    if (trip.status !== 'on_ride') { res.status(409).json({ message: 'El viaje debe estar en estado on_ride' }); return }

    trip.status = 'completed'
    trip.completedAt = new Date()
    trip.duration = Math.floor(15 + Math.random() * 40)
    await tripRepo.save(trip)

    const updated = await tripRepo.findOne({ where: { id: trip.id }, relations: ['passenger', 'driver'] })!
    const serialized = serializeTrip(updated!)
    emitTripStatusUpdated(updated!.passengerId, updated!.driverId, serialized, 'trip:completed')
    res.json({ data: serialized })
})

// ── POST /api/travels/:id/cancel ──────────────────────────────────────────────
/**
 * @openapi
 * /api/travels/{id}/cancel:
 *   post:
 *     tags: [Trips]
 *     summary: "[Alias] Cancelar un viaje"
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
 */
router.post('/:id/cancel', async (req, res) => {
    const tripRepo = AppDataSource.getRepository(Trip)
    const trip = await tripRepo.findOne({ where: { id: req.params.id } })
    if (!trip) { res.status(404).json({ message: 'Viaje no encontrado' }); return }

    const userId = req.user!.id
    if (trip.passengerId !== userId && trip.driverId !== userId) {
        res.status(403).json({ message: 'Sin permisos para cancelar este viaje' }); return
    }
    if (['completed', 'cancelled'].includes(trip.status)) {
        res.status(409).json({ message: `El viaje ya está ${trip.status}` }); return
    }

    trip.status = 'cancelled'
    await tripRepo.save(trip)

    const updated = await tripRepo.findOne({ where: { id: trip.id }, relations: ['passenger', 'driver'] })!
    const serialized = serializeTrip(updated!)
    emitTripStatusUpdated(updated!.passengerId, updated!.driverId, serialized, 'trip:cancelled')
    res.json({ data: serialized })
})

export default router
