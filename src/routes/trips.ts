import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { db } from '../db/init.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import type { Trip, User } from '../types/index.js'

const router = Router()

// All trip routes require authentication
router.use(authenticate)

// Helper: map DB row to Trip object
function rowToTrip(row: Record<string, unknown>, passenger?: User, driver?: User): Trip {
    return {
        id: row.id as string,
        passengerId: row.passenger_id as string,
        driverId: row.driver_id as string | undefined,
        passenger,
        driver,
        originAddress: row.origin_address as string,
        originLat: row.origin_lat as number,
        originLng: row.origin_lng as number,
        destinationAddress: row.destination_address as string,
        destinationLat: row.destination_lat as number,
        destinationLng: row.destination_lng as number,
        status: row.status as Trip['status'],
        vehicleType: row.vehicle_type as Trip['vehicleType'],
        notes: row.notes as string | undefined,
        fare: row.fare as number | undefined,
        distance: row.distance as number | undefined,
        duration: row.duration as number | undefined,
        requestedAt: row.requested_at as string,
        acceptedAt: row.accepted_at as string | undefined,
        startedAt: row.started_at as string | undefined,
        completedAt: row.completed_at as string | undefined,
    }
}

function getUser(id: string): User | undefined {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) return undefined
    return {
        id: row.id as string,
        name: row.name as string,
        email: row.email as string,
        role: row.role as 'passenger' | 'driver',
        phone: row.phone as string | undefined,
        rating: row.rating as number,
        createdAt: row.created_at as string,
    }
}

// ── POST /api/trips ─────────────────────────────────────────
router.post('/', requireRole('passenger'), (req, res) => {
    const schema = z.object({
        originAddress: z.string().min(3),
        destinationAddress: z.string().min(3),
        vehicleType: z.enum(['standard', 'comfort', 'xl']).default('standard'),
        notes: z.string().max(300).optional(),
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
        res.status(422).json({ message: 'Datos inválidos', errors: parsed.error.flatten() })
        return
    }

    const { originAddress, destinationAddress, vehicleType, notes } = parsed.data

    // Check passenger doesn't already have an active trip
    const existing = db.prepare(`
    SELECT id FROM trips
    WHERE passenger_id = ? AND status IN ('requested','accepted','on_ride')
  `).get(req.user!.id)

    if (existing) {
        res.status(409).json({ message: 'Ya tienes un viaje activo' })
        return
    }

    // Simulate random coords around Bogotá
    const id = randomUUID()
    const lat = () => 4.6097 + (Math.random() - 0.5) * 0.05
    const lng = () => -74.0817 + (Math.random() - 0.5) * 0.05

    db.prepare(`
    INSERT INTO trips (
      id, passenger_id, origin_address, origin_lat, origin_lng,
      destination_address, destination_lat, destination_lng,
      status, vehicle_type, notes, requested_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, datetime('now'))
  `).run(id, req.user!.id, originAddress, lat(), lng(), destinationAddress, lat(), lng(), vehicleType, notes || null)

    const row = db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as Record<string, unknown>
    const trip = rowToTrip(row, req.user)

    res.status(201).json({ data: trip })
})

// ── GET /api/trips/available ─────────────────────────────────
router.get('/available', requireRole('driver'), (_req, res) => {
    const rows = db.prepare(`
    SELECT * FROM trips WHERE status = 'requested' ORDER BY requested_at DESC
  `).all() as Record<string, unknown>[]

    const trips = rows.map((row) => {
        const passenger = getUser(row.passenger_id as string)
        return rowToTrip(row, passenger)
    })

    res.json({ data: trips })
})

// ── GET /api/trips/active ─────────────────────────────────────
router.get('/active', (req, res) => {
    const user = req.user!
    const field = user.role === 'passenger' ? 'passenger_id' : 'driver_id'

    const row = db.prepare(`
    SELECT * FROM trips
    WHERE ${field} = ? AND status IN ('requested','accepted','on_ride')
    ORDER BY requested_at DESC LIMIT 1
  `).get(user.id) as Record<string, unknown> | undefined

    if (!row) {
        res.status(404).json({ message: 'No hay viaje activo' })
        return
    }

    const passenger = getUser(row.passenger_id as string)
    const driver = row.driver_id ? getUser(row.driver_id as string) : undefined
    res.json({ data: rowToTrip(row, passenger, driver) })
})

// ── GET /api/trips/history ────────────────────────────────────
router.get('/history', (req, res) => {
    const user = req.user!
    const field = user.role === 'passenger' ? 'passenger_id' : 'driver_id'

    const rows = db.prepare(`
    SELECT * FROM trips
    WHERE ${field} = ? AND status IN ('completed','cancelled')
    ORDER BY requested_at DESC
  `).all(user.id) as Record<string, unknown>[]

    const trips = rows.map((row) => {
        const passenger = getUser(row.passenger_id as string)
        const driver = row.driver_id ? getUser(row.driver_id as string) : undefined
        return rowToTrip(row, passenger, driver)
    })

    res.json({ data: trips })
})

// ── POST /api/trips/:id/accept ────────────────────────────────
router.post('/:id/accept', requireRole('driver'), (req, res) => {
    const row = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!row) {
        res.status(404).json({ message: 'Viaje no encontrado' })
        return
    }
    if (row.status !== 'requested') {
        res.status(409).json({ message: 'El viaje ya no está disponible' })
        return
    }

    const fare = Math.floor(15000 + Math.random() * 30000)
    const distance = Math.round((5 + Math.random() * 20) * 10) / 10

    db.prepare(`
    UPDATE trips SET
      driver_id = ?, status = 'accepted', fare = ?, distance = ?,
      accepted_at = datetime('now')
    WHERE id = ?
  `).run(req.user!.id, fare, distance, req.params.id)

    const updated = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id) as Record<string, unknown>
    const passenger = getUser(updated.passenger_id as string)
    const driver = getUser(req.user!.id)
    res.json({ data: rowToTrip(updated, passenger, driver) })
})

// ── PATCH /api/trips/:id/status ───────────────────────────────
router.patch('/:id/status', (req, res) => {
    const schema = z.object({
        status: z.enum(['on_ride', 'completed', 'cancelled']),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
        res.status(422).json({ message: 'Estado inválido' })
        return
    }

    const row = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!row) {
        res.status(404).json({ message: 'Viaje no encontrado' })
        return
    }

    const { status } = parsed.data
    let extraFields = ''

    if (status === 'on_ride') {
        extraFields = ", started_at = datetime('now')"
    } else if (status === 'completed') {
        const duration = Math.floor(15 + Math.random() * 40)
        extraFields = `, completed_at = datetime('now'), duration = ${duration}`
    }

    db.prepare(`UPDATE trips SET status = ?${extraFields} WHERE id = ?`).run(status, req.params.id)

    const updated = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id) as Record<string, unknown>
    const passenger = getUser(updated.passenger_id as string)
    const driver = updated.driver_id ? getUser(updated.driver_id as string) : undefined
    res.json({ data: rowToTrip(updated, passenger, driver) })
})

// ── GET /api/trips/:id ────────────────────────────────────────
router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!row) {
        res.status(404).json({ message: 'Viaje no encontrado' })
        return
    }

    const passenger = getUser(row.passenger_id as string)
    const driver = row.driver_id ? getUser(row.driver_id as string) : undefined
    res.json({ data: rowToTrip(row, passenger, driver) })
})

export default router
