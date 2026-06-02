import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { AppDataSource } from '../config/database'
import { RefreshToken } from '../entities/RefreshToken'
import type { User } from '../entities/User'

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret_dev'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_dev'
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d'

export interface AuthTokens {
    accessToken: string
    refreshToken: string
}

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

    const rtRepo = AppDataSource.getRepository(RefreshToken)
    const rt = rtRepo.create({
        id: refreshJti,
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    await rtRepo.save(rt)

    return { accessToken, refreshToken }
}

export function verifyAccessToken(token: string): { sub: string; role: string } {
    return jwt.verify(token, ACCESS_SECRET) as { sub: string; role: string }
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string }> {
    const payload = jwt.verify(token, REFRESH_SECRET) as { sub: string }

    const rtRepo = AppDataSource.getRepository(RefreshToken)
    const rt = await rtRepo.findOne({
        where: { token },
    })

    if (!rt || rt.expiresAt < new Date()) {
        throw new Error('Refresh token invalid or expired')
    }

    return payload
}

export async function revokeRefreshToken(token: string): Promise<void> {
    const rtRepo = AppDataSource.getRepository(RefreshToken)
    await rtRepo.delete({ token })
}
