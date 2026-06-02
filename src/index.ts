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
const PORT = Number(process.env.PORT) || 8000

// ── Security Middleware ────────────────────────────────────────────────────────
app.use(helmet())

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error(`CORS not allowed: ${origin}`))
        }
    },
    credentials: true,
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

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
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
        logger.info('✅ TypeORM connected to PostgreSQL (Supabase)')

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
