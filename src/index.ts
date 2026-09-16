import 'reflect-metadata'
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import swaggerUi from 'swagger-ui-express'
import { AppDataSource } from './config/database'
import { swaggerSpec } from './config/swagger'
import { initSocket } from './services/socket'
import { logger } from './logger'
import authRouter from './routes/auth'
import tripsRouter from './routes/trips'
import travelsRouter from './routes/travels'
import meRouter from './routes/me'
import { errorHandler } from './middleware/auth'

const app = express()
app.set('trust proxy', 1) // Trust Elastic Beanstalk / ALB reverse proxy for proper client IP rate limiting
const PORT = Number(process.env.PORT) || 8080

// ── Security Middleware ────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false,
}))

const corsOriginEnv = process.env.CORS_ORIGIN || 'http://localhost:5173'
const allowAll = corsOriginEnv.trim() === '*'
const allowedOrigins = corsOriginEnv.split(',').map(o => o.trim())

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (health checks, curl, server-to-server)
        if (!origin) return callback(null, true)
        // Allow all origins when CORS_ORIGIN=*
        if (allowAll) return callback(null, true)
        // Check against whitelist
        if (allowedOrigins.includes(origin)) return callback(null, true)
        callback(new Error(`CORS not allowed: ${origin}`))
    },
    credentials: !allowAll, // credentials can't be used with wildcard origin
}))

// Rate limiting: 100 req per 15 minutes per IP
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas peticiones, intenta más tarde' },
}))

app.use(express.json())

// Morgan uses Winston under the hood
app.use(morgan(
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    { stream: { write: (msg) => logger.http(msg.trim()) } },
))

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: '🚖 TaxiGo API Docs',
    customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.6/swagger-ui.css',
    customJs: [
        'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.6/swagger-ui-bundle.js',
        'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.6/swagger-ui-standalone-preset.js'
    ],
    swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
    },
}))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/trips', tripsRouter)
app.use('/api/travels', travelsRouter)  // Alias: academic requirement
app.use('/api/me', meRouter)            // Alias: GET /api/me/travels

// ── Root endpoint (Elastic Beanstalk health check) ────────────────────────────
app.get('/', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'taxigo-api',
        timestamp: new Date().toISOString(),
    })
})

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'si',
        timestamp: new Date().toISOString(),
        db: AppDataSource.isInitialized ? 'connected' : 'disconnected',
    })
})

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' })
})

// ── Error handler ──────────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
    try {
        await AppDataSource.initialize()
        logger.info('✅ TypeORM connected to MySQL (RDS)')

        const httpServer = createServer(app)
        initSocket(httpServer)

        httpServer.listen(PORT, () => {
            logger.info(`🚖 TaxiGo API running on http://localhost:${PORT}`)
            logger.info(`📚 Swagger UI: http://localhost:${PORT}/api/docs`)
            logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`)
        })
    } catch (error) {
        logger.error('❌ Failed to start server:', { error })
        process.exit(1)
    }
}

bootstrap()

export default app
