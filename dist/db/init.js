import pg from 'pg';
const { Pool } = pg;
export const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? undefined : { rejectUnauthorized: false },
});
export async function initDb() {
    try {
        await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          VARCHAR(255) PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(50) NOT NULL CHECK(role IN ('passenger', 'driver')),
        phone       VARCHAR(255),
        rating      NUMERIC NOT NULL DEFAULT 5.0,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          VARCHAR(255) PRIMARY KEY,
        user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token       TEXT NOT NULL UNIQUE,
        expires_at  TIMESTAMP NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS trips (
        id                  VARCHAR(255) PRIMARY KEY,
        passenger_id        VARCHAR(255) NOT NULL REFERENCES users(id),
        driver_id           VARCHAR(255) REFERENCES users(id),
        origin_address      TEXT NOT NULL,
        origin_lat          NUMERIC NOT NULL,
        origin_lng          NUMERIC NOT NULL,
        destination_address TEXT NOT NULL,
        destination_lat     NUMERIC NOT NULL,
        destination_lng     NUMERIC NOT NULL,
        status              VARCHAR(50) NOT NULL DEFAULT 'requested'
                            CHECK(status IN ('requested','accepted','on_ride','completed','cancelled')),
        vehicle_type        VARCHAR(50) NOT NULL DEFAULT 'standard'
                            CHECK(vehicle_type IN ('standard','comfort','xl')),
        notes               TEXT,
        fare                NUMERIC,
        distance            NUMERIC,
        duration            INTEGER,
        requested_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        accepted_at         TIMESTAMP,
        started_at          TIMESTAMP,
        completed_at        TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_trips_passenger ON trips(passenger_id);
      CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
      CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
    `);
        console.log('✅ PostgreSQL Database initialized');
    }
    catch (error) {
        console.error('❌ Database initialization failed:', error);
    }
}
