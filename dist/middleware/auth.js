"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.errorHandler = errorHandler;
const jwt_1 = require("../services/jwt");
const database_1 = require("../config/database");
const User_1 = require("../entities/User");
const logger_1 = require("../logger");
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No autorizado' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        const user = await userRepo.findOne({ where: { id: payload.sub } });
        if (!user) {
            res.status(401).json({ message: 'Usuario no encontrado' });
            return;
        }
        req.user = user;
        next();
    }
    catch {
        res.status(401).json({ message: 'Token inválido o expirado' });
    }
}
function requireRole(role) {
    return (req, res, next) => {
        if (req.user?.role !== role) {
            res.status(403).json({ message: 'Acceso denegado: rol insuficiente' });
            return;
        }
        next();
    };
}
function errorHandler(err, req, res, _next) {
    logger_1.logger.error({ message: err.message, path: req.path, stack: err.stack });
    res.status(500).json({ message: err.message || 'Error interno del servidor' });
}
