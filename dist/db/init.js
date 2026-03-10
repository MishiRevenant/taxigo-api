import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH
    ? join(process.cwd(), process.env.DB_PATH)
    : join(__dirname, '../../taxigo.db');
export const db = new Database(dbPath);
// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
export function initDb() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('passenger', 'driver')),
      phone       TEXT,
      rating      REAL NOT NULL DEFAULT 5.0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trips (
      id                  TEXT PRIMARY KEY,
      passenger_id        TEXT NOT NULL REFERENCES users(id),
      driver_id           TEXT REFERENCES users(id),
      origin_address      TEXT NOT NULL,
      origin_lat          REAL NOT NULL,
      origin_lng          REAL NOT NULL,
      destination_address TEXT NOT NULL,
      destination_lat     REAL NOT NULL,
      destination_lng     REAL NOT NULL,
      status              TEXT NOT NULL DEFAULT 'requested'
                          CHECK(status IN ('requested','accepted','on_ride','completed','cancelled')),
      vehicle_type        TEXT NOT NULL DEFAULT 'standard'
                          CHECK(vehicle_type IN ('standard','comfort','xl')),
      notes               TEXT,
      fare                REAL,
      distance            REAL,
      duration            INTEGER,
      requested_at        TEXT NOT NULL DEFAULT (datetime('now')),
      accepted_at         TEXT,
      started_at          TEXT,
      completed_at        TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_trips_passenger ON trips(passenger_id);
    CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
    CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
  `);
    console.log('✅ Database initialized at:', dbPath);
}
