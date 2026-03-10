import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db } from '../db/init.js';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret_dev';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_dev';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
export function generateTokens(user) {
    const accessToken = jwt.sign({ sub: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
    const refreshToken = jwt.sign({ sub: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
    // Persist refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(randomUUID(), user.id, refreshToken, expiresAt);
    return { accessToken, refreshToken };
}
export function verifyAccessToken(token) {
    return jwt.verify(token, ACCESS_SECRET);
}
export function verifyRefreshToken(token) {
    const payload = jwt.verify(token, REFRESH_SECRET);
    // Check it exists and isn't expired in DB
    const record = db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime(\'now\')').get(token);
    if (!record)
        throw new Error('Refresh token invalid or expired');
    return payload;
}
export function revokeRefreshToken(token) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
}
