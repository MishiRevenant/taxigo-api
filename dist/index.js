"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const database_1 = require("./config/database");
const swagger_1 = require("./config/swagger");
const socket_1 = require("./services/socket");
const logger_1 = require("./logger");
const auth_1 = __importDefault(require("./routes/auth"));
const trips_1 = __importDefault(require("./routes/trips"));
const travels_1 = __importDefault(require("./routes/travels"));
const me_1 = __importDefault(require("./routes/me"));
const auth_2 = require("./middleware/auth");
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 8000;
// ── Security Middleware ────────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS not allowed: ${origin}`));
        }
    },
    credentials: true,
}));
// Rate limiting: 100 req per 15 minutes per IP
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas peticiones, intenta más tarde' },
}));
app.use(express_1.default.json());
// Morgan uses Winston under the hood
app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream: { write: (msg) => logger_1.logger.http(msg.trim()) } }));
// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
    customSiteTitle: '🚖 TaxiGo API Docs',
    swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
    },
}));
// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', auth_1.default);
app.use('/api/trips', trips_1.default);
app.use('/api/travels', travels_1.default); // Alias: academic requirement
app.use('/api/me', me_1.default); // Alias: GET /api/me/travels
// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: database_1.AppDataSource.isInitialized ? 'connected' : 'disconnected',
    });
});
// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});
// ── Error handler ──────────────────────────────────────────────────────────────
app.use(auth_2.errorHandler);
// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
    try {
        await database_1.AppDataSource.initialize();
        logger_1.logger.info('✅ TypeORM connected to PostgreSQL (Supabase)');
        const httpServer = (0, http_1.createServer)(app);
        (0, socket_1.initSocket)(httpServer);
        httpServer.listen(PORT, () => {
            logger_1.logger.info(`🚖 TaxiGo API running on http://localhost:${PORT}`);
            logger_1.logger.info(`📚 Swagger UI: http://localhost:${PORT}/api/docs`);
            logger_1.logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to start server:', { error });
        process.exit(1);
    }
}
bootstrap();
exports.default = app;
