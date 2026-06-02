import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Initial schema migration.
 * Compatible with existing Supabase tables – uses IF NOT EXISTS and IF NOT EXISTS on columns
 * so it is safe to run against a database that already has the tables.
 */
export class InitialSchema1717286000000 implements MigrationInterface {
    name = 'InitialSchema1717286000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── users ──────────────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS users (
                id          VARCHAR(255) PRIMARY KEY,
                name        VARCHAR(255) NOT NULL,
                email       VARCHAR(255) UNIQUE NOT NULL,
                password    VARCHAR(255) NOT NULL,
                role        VARCHAR(50)  NOT NULL CHECK(role IN ('passenger', 'driver')),
                phone       VARCHAR(255),
                rating      NUMERIC      NOT NULL DEFAULT 5.0,
                created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // ── refresh_tokens ─────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id         VARCHAR(255) PRIMARY KEY,
                user_id    VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token      TEXT         NOT NULL UNIQUE,
                expires_at TIMESTAMP    NOT NULL,
                created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // ── trips ──────────────────────────────────────────────────────────────
        await queryRunner.query(`
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
            )
        `)

        // ── indexes ────────────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_trips_passenger ON trips(passenger_id)
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id)
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS trips`)
        await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`)
        await queryRunner.query(`DROP TABLE IF EXISTS users`)
    }
}
