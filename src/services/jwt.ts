import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { db } from '../db/init.js'
import type { User, AuthTokens } from '../types/index.js'

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret_dev'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_dev'
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d'

export async function generateTokens(user: User): Promise<AuthTokens> {
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
    await db.query(`
        INSERT INTO refresh_tokens (id, user_id, token, expires_at) 
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (token) DO NOTHING
    `, [refreshJti, user.id, refreshToken, expiresAt])

    return { accessToken, refreshToken }
}

export function verifyAccessToken(token: string): { sub: string; role: string } {
    return jwt.verify(token, ACCESS_SECRET) as { sub: string; role: string }
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string }> {
    const payload = jwt.verify(token, REFRESH_SECRET) as { sub: string }

    // Check it exists and isn't expired in DB
    const { rows } = await db.query(
        'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
        [token]
    )

    if (rows.length === 0) throw new Error('Refresh token invalid or expired')
    return payload
}

export async function revokeRefreshToken(token: string) {
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [token])
}
