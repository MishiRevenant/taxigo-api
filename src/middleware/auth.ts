import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../services/jwt.js'
import { db } from '../db/init.js'
import type { User } from '../types/index.js'

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No autorizado' })
        return
    }

    const token = authHeader.slice(7)
    try {
        const payload = verifyAccessToken(token)
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [payload.sub])
        const userRow = rows[0]
        if (!userRow) {
            res.status(401).json({ message: 'Usuario no encontrado' })
            return
        }
        const { password: _pw, ...user } = userRow
        req.user = user as User
        next()
    } catch {
        res.status(401).json({ message: 'Token inválido o expirado' })
    }
}

export function requireRole(role: 'passenger' | 'driver') {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.user?.role !== role) {
            res.status(403).json({ message: 'Acceso denegado' })
            return
        }
        next()
    }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
    console.error(err)
    res.status(500).json({ message: err.message || 'Error interno del servidor' })
}
