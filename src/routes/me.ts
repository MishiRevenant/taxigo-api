/**
 * GET /api/me/travels  — historial de viajes del usuario autenticado
 * Alias académico de GET /api/trips/history
 */
import { Router } from 'express'
import { AppDataSource } from '../config/database'
import { Trip } from '../entities/Trip'
import { authenticate } from '../middleware/auth'
import { In } from 'typeorm'

const router = Router()
router.use(authenticate)

/**
 * @openapi
 * /api/me/travels:
 *   get:
 *     tags: [Trips]
 *     summary: "[Alias] Consultar mis viajes (historial)"
 *     description: "Alias de GET /api/trips/history"
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Historial de viajes del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Trip' }
 */
router.get('/travels', async (req, res) => {
    const user = req.user!
    const tripRepo = AppDataSource.getRepository(Trip)

    const where = user.role === 'passenger'
        ? { passengerId: user.id, status: In(['completed', 'cancelled']) }
        : { driverId: user.id, status: In(['completed', 'cancelled']) }

    try {
        const trips = await tripRepo.find({
            where,
            relations: ['passenger', 'driver'],
            order: { requestedAt: 'DESC' },
        })
        res.json({ data: trips.map(t => ({
            id: t.id, passengerId: t.passengerId, driverId: t.driverId,
            originAddress: t.originAddress, destinationAddress: t.destinationAddress,
            status: t.status, vehicleType: t.vehicleType,
            fare: t.fare !== null ? Number(t.fare) : null,
            distance: t.distance !== null ? Number(t.distance) : null,
            duration: t.duration,
            requestedAt: t.requestedAt?.toISOString(),
            completedAt: t.completedAt?.toISOString() ?? null,
        })) })
    } catch (err) {
        res.status(500).json({ message: 'Error interno del servidor' })
    }
})

export default router
