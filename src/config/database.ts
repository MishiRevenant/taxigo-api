import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { User } from '../entities/User'
import { Trip } from '../entities/Trip'
import { RefreshToken } from '../entities/RefreshToken'

const isProd = process.env.NODE_ENV === 'production'

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    entities: [User, Trip, RefreshToken],
    // In production, disable synchronize and use migrations
    synchronize: false,
    migrations: [__dirname + '/../migrations/*.{ts,js}'],
    migrationsRun: true,
    logging: !isProd,
})
