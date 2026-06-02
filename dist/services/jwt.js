"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTokens = generateTokens;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.revokeRefreshToken = revokeRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const database_1 = require("../config/database");
const RefreshToken_1 = require("../entities/RefreshToken");
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret_dev';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_dev';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
async function generateTokens(user) {
    const jti = (0, crypto_1.randomUUID)();
    const accessToken = jsonwebtoken_1.default.sign({ sub: user.id, role: user.role, jti }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
    const refreshJti = (0, crypto_1.randomUUID)();
    const refreshToken = jsonwebtoken_1.default.sign({ sub: user.id, jti: refreshJti }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
    const rtRepo = database_1.AppDataSource.getRepository(RefreshToken_1.RefreshToken);
    const rt = rtRepo.create({
        id: refreshJti,
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await rtRepo.save(rt);
    return { accessToken, refreshToken };
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
}
async function verifyRefreshToken(token) {
    const payload = jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
    const rtRepo = database_1.AppDataSource.getRepository(RefreshToken_1.RefreshToken);
    const rt = await rtRepo.findOne({
        where: { token },
    });
    if (!rt || rt.expiresAt < new Date()) {
        throw new Error('Refresh token invalid or expired');
    }
    return payload;
}
async function revokeRefreshToken(token) {
    const rtRepo = database_1.AppDataSource.getRepository(RefreshToken_1.RefreshToken);
    await rtRepo.delete({ token });
}
