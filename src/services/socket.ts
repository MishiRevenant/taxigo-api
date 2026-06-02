import { Server as SocketIOServer } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { logger } from '../logger'

let io: SocketIOServer | null = null

export function initSocket(httpServer: HttpServer): SocketIOServer {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
            methods: ['GET', 'POST'],
            credentials: true,
        },
    })

    io.on('connection', (socket) => {
        logger.info(`[WS] Client connected: ${socket.id}`)

        // Passenger / driver join their own room on connect
        socket.on('join', (userId: string) => {
            socket.join(`user:${userId}`)
            logger.debug(`[WS] ${socket.id} joined room user:${userId}`)
        })

        // Driver joins the "drivers" room to receive new trip requests
        socket.on('join:drivers', () => {
            socket.join('drivers')
            logger.debug(`[WS] Driver ${socket.id} joined drivers room`)
        })

        socket.on('disconnect', () => {
            logger.info(`[WS] Client disconnected: ${socket.id}`)
        })
    })

    logger.info('✅ Socket.IO initialized')
    return io
}

/** Get the global Socket.IO instance */
export function getIO(): SocketIOServer {
    if (!io) throw new Error('Socket.IO not initialized')
    return io
}

// ── Event emitters ────────────────────────────────────────────────────────────

/** Notify all drivers that a new trip has been requested */
export function emitTripRequested(trip: object) {
    getIO().to('drivers').emit('trip:requested', trip)
}

/** Notify the passenger that their trip was accepted */
export function emitTripAccepted(passengerId: string, trip: object) {
    getIO().to(`user:${passengerId}`).emit('trip:accepted', trip)
}

/** Notify passenger & driver about a status update */
export function emitTripStatusUpdated(
    passengerId: string,
    driverId: string | null | undefined,
    trip: object,
    event: 'trip:started' | 'trip:completed' | 'trip:cancelled' | 'trip:updated',
) {
    getIO().to(`user:${passengerId}`).emit(event, trip)
    if (driverId) {
        getIO().to(`user:${driverId}`).emit(event, trip)
    }
}
