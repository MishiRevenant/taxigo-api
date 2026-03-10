import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';
const router = Router();
// All trip routes require authentication
router.use(authenticate);
// Helper: map DB row to Trip object
function rowToTrip(row, passenger, driver) {
    return {
        id: row.id,
        passengerId: row.passenger_id,
        driverId: row.driver_id,
        passenger,
        driver,
        originAddress: row.origin_address,
        originLat: Number(row.origin_lat),
        originLng: Number(row.origin_lng),
        destinationAddress: row.destination_address,
        destinationLat: Number(row.destination_lat),
        destinationLng: Number(row.destination_lng),
        status: row.status,
        vehicleType: row.vehicle_type,
        notes: row.notes,
        fare: row.fare ? Number(row.fare) : undefined,
        distance: row.distance ? Number(row.distance) : undefined,
        duration: row.duration ? Number(row.duration) : undefined,
        requestedAt: row.requested_at ? new Date(row.requested_at).toISOString() : new Date().toISOString(),
        acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : undefined,
        startedAt: row.started_at ? new Date(row.started_at).toISOString() : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    };
}
async function getUser(id) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    const row = rows[0];
    if (!row)
        return undefined;
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        phone: row.phone,
        rating: Number(row.rating),
        createdAt: new Date(row.created_at).toISOString(),
    };
}
// ── POST /api/trips ─────────────────────────────────────────
router.post('/', requireRole('passenger'), async (req, res) => {
    const schema = z.object({
        originAddress: z.string().min(3),
        destinationAddress: z.string().min(3),
        vehicleType: z.enum(['standard', 'comfort', 'xl']).default('standard'),
        notes: z.string().max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ message: 'Datos inválidos', errors: parsed.error.flatten() });
        return;
    }
    const { originAddress, destinationAddress, vehicleType, notes } = parsed.data;
    try {
        // Check passenger doesn't already have an active trip
        const { rows: existingTrips } = await db.query(`
            SELECT id FROM trips
            WHERE passenger_id = $1 AND status IN ('requested','accepted','on_ride')
        `, [req.user.id]);
        if (existingTrips.length > 0) {
            res.status(409).json({ message: 'Ya tienes un viaje activo' });
            return;
        }
        // Simulate random coords around Bogotá
        const id = randomUUID();
        const lat = () => 4.6097 + (Math.random() - 0.5) * 0.05;
        const lng = () => -74.0817 + (Math.random() - 0.5) * 0.05;
        await db.query(`
            INSERT INTO trips (
                id, passenger_id, origin_address, origin_lat, origin_lng,
                destination_address, destination_lat, destination_lng,
                status, vehicle_type, notes, requested_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'requested', $9, $10, CURRENT_TIMESTAMP)
        `, [
            id, req.user.id, originAddress, lat(), lng(), destinationAddress, lat(), lng(), vehicleType, notes || null
        ]);
        const { rows } = await db.query('SELECT * FROM trips WHERE id = $1', [id]);
        const trip = rowToTrip(rows[0], req.user);
        res.status(201).json({ data: trip });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── GET /api/trips/available ─────────────────────────────────
router.get('/available', requireRole('driver'), async (_req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT * FROM trips WHERE status = 'requested' ORDER BY requested_at DESC
        `);
        const trips = await Promise.all(rows.map(async (row) => {
            const passenger = await getUser(row.passenger_id);
            return rowToTrip(row, passenger);
        }));
        res.json({ data: trips });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── GET /api/trips/active ─────────────────────────────────────
router.get('/active', async (req, res) => {
    const user = req.user;
    const field = user.role === 'passenger' ? 'passenger_id' : 'driver_id';
    try {
        const { rows } = await db.query(`
            SELECT * FROM trips
            WHERE ${field} = $1 AND status IN ('requested','accepted','on_ride')
            ORDER BY requested_at DESC LIMIT 1
        `, [user.id]);
        const row = rows[0];
        if (!row) {
            res.status(404).json({ message: 'No hay viaje activo' });
            return;
        }
        const passenger = await getUser(row.passenger_id);
        const driver = row.driver_id ? await getUser(row.driver_id) : undefined;
        res.json({ data: rowToTrip(row, passenger, driver) });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── GET /api/trips/history ────────────────────────────────────
router.get('/history', async (req, res) => {
    const user = req.user;
    const field = user.role === 'passenger' ? 'passenger_id' : 'driver_id';
    try {
        const { rows } = await db.query(`
            SELECT * FROM trips
            WHERE ${field} = $1 AND status IN ('completed','cancelled')
            ORDER BY requested_at DESC
        `, [user.id]);
        const trips = await Promise.all(rows.map(async (row) => {
            const passenger = await getUser(row.passenger_id);
            const driver = row.driver_id ? await getUser(row.driver_id) : undefined;
            return rowToTrip(row, passenger, driver);
        }));
        res.json({ data: trips });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── POST /api/trips/:id/accept ────────────────────────────────
router.post('/:id/accept', requireRole('driver'), async (req, res) => {
    try {
        const { rows: initialRows } = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
        const row = initialRows[0];
        if (!row) {
            res.status(404).json({ message: 'Viaje no encontrado' });
            return;
        }
        if (row.status !== 'requested') {
            res.status(409).json({ message: 'El viaje ya no está disponible' });
            return;
        }
        const fare = Math.floor(15000 + Math.random() * 30000);
        const distance = Math.round((5 + Math.random() * 20) * 10) / 10;
        await db.query(`
            UPDATE trips SET
            driver_id = $1, status = 'accepted', fare = $2, distance = $3,
            accepted_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [req.user.id, fare, distance, req.params.id]);
        const { rows: updatedRows } = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
        const updated = updatedRows[0];
        const passenger = await getUser(updated.passenger_id);
        const driver = await getUser(req.user.id);
        res.json({ data: rowToTrip(updated, passenger, driver) });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── PATCH /api/trips/:id/status ───────────────────────────────
router.patch('/:id/status', async (req, res) => {
    const schema = z.object({
        status: z.enum(['on_ride', 'completed', 'cancelled']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ message: 'Estado inválido' });
        return;
    }
    try {
        const { rows: initialRows } = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
        const row = initialRows[0];
        if (!row) {
            res.status(404).json({ message: 'Viaje no encontrado' });
            return;
        }
        const { status } = parsed.data;
        let query = 'UPDATE trips SET status = $1';
        const params = [status];
        if (status === 'on_ride') {
            query += ', started_at = CURRENT_TIMESTAMP';
        }
        else if (status === 'completed') {
            const duration = Math.floor(15 + Math.random() * 40);
            query += `, completed_at = CURRENT_TIMESTAMP, duration = $2`;
            params.push(duration);
        }
        query += ` WHERE id = $${params.length + 1}`;
        params.push(req.params.id);
        await db.query(query, params);
        const { rows: updatedRows } = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
        const updated = updatedRows[0];
        const passenger = await getUser(updated.passenger_id);
        const driver = updated.driver_id ? await getUser(updated.driver_id) : undefined;
        res.json({ data: rowToTrip(updated, passenger, driver) });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
// ── GET /api/trips/:id ────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
        const row = rows[0];
        if (!row) {
            res.status(404).json({ message: 'Viaje no encontrado' });
            return;
        }
        const passenger = await getUser(row.passenger_id);
        const driver = row.driver_id ? await getUser(row.driver_id) : undefined;
        res.json({ data: rowToTrip(row, passenger, driver) });
    }
    catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});
export default router;
