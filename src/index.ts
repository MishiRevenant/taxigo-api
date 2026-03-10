import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { initDb } from './db/init.js'
import authRouter from './routes/auth.js'
import tripsRouter from './routes/trips.js'
import { errorHandler } from './middleware/auth.js'

const app = express()
const PORT = Number(process.env.PORT) || 8000

// ── DB ────────────────────────────────────────────────────
initDb()

// ── Middleware ─────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')

app.use(helmet())
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
app.use(express.json())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/trips', tripsRouter)

// ── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── 404 ────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' })
})

// ── Error Handler ──────────────────────────────────────────
app.use(errorHandler)

app.listen(PORT, () => {
    console.log(`🚖 TaxiGo API running on http://localhost:${PORT}`)
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
