import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { User } from '../entities/User'
import { Trip } from '../entities/Trip'
import { RefreshToken } from '../entities/RefreshToken'

const isProd = process.env.NODE_ENV === 'production'

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'taxigo',
    charset: 'utf8mb4',
    entities: [User, Trip, RefreshToken],
    // In production, disable synchronize and use migrations
    synchronize: false,
    migrations: [__dirname + '/../migrations/*.{ts,js}'],
    migrationsRun: true,
    logging: !isProd,
})
