import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { db } from '../db/init.js'
import type { User, AuthTokens } from '../types/index.js'

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret_dev'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_dev'
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d'

export function generateTokens(user: User): AuthTokens {
    const jti = randomUUID()
    const accessToken = jwt.sign(
        { sub: user.id, role: user.role, jti },
        ACCESS_SECRET,
        { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions,
    )

    const refreshJti = randomUUID()
    const refreshToken = jwt.sign(
        { sub: user.id, jti: refreshJti },
        REFRESH_SECRET,
        { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions,
    )

    // Persist refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(
        'INSERT OR IGNORE INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
    ).run(refreshJti, user.id, refreshToken, expiresAt)

    return { accessToken, refreshToken }
}

export function verifyAccessToken(token: string): { sub: string; role: string } {
    return jwt.verify(token, ACCESS_SECRET) as { sub: string; role: string }
}

export function verifyRefreshToken(token: string): { sub: string } {
    const payload = jwt.verify(token, REFRESH_SECRET) as { sub: string }

    // Check it exists and isn't expired in DB
    const record = db.prepare(
        'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime(\'now\')',
    ).get(token)

    if (!record) throw new Error('Refresh token invalid or expired')
    return payload
}

export function revokeRefreshToken(token: string) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token)
}
