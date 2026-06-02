import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../services/jwt'
import { AppDataSource } from '../config/database'
import { User } from '../entities/User'
import { logger } from '../logger'

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No autorizado' })
        return
    }

    const token = authHeader.slice(7)
    try {
        const payload = verifyAccessToken(token)
        const userRepo = AppDataSource.getRepository(User)
        const user = await userRepo.findOne({ where: { id: payload.sub } })
        if (!user) {
            res.status(401).json({ message: 'Usuario no encontrado' })
            return
        }
        req.user = user
        next()
    } catch {
        res.status(401).json({ message: 'Token inválido o expirado' })
    }
}

export function requireRole(role: 'passenger' | 'driver') {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.user?.role !== role) {
            res.status(403).json({ message: 'Acceso denegado: rol insuficiente' })
            return
        }
        next()
    }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
    logger.error({ message: err.message, path: req.path, stack: err.stack })
    res.status(500).json({ message: err.message || 'Error interno del servidor' })
}
