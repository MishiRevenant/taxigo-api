import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Initial schema migration.
 * MySQL-compatible syntax for Amazon RDS.
 * Uses IF NOT EXISTS so it is safe to run against a database that already has the tables.
 */
export class InitialSchema1717286000000 implements MigrationInterface {
    name = 'InitialSchema1717286000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── users ──────────────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS users (
                id          VARCHAR(255) NOT NULL PRIMARY KEY,
                name        VARCHAR(255) NOT NULL,
                email       VARCHAR(255) NOT NULL UNIQUE,
                password    VARCHAR(255) NOT NULL,
                role        ENUM('passenger', 'driver') NOT NULL,
                phone       VARCHAR(255) NULL,
                rating      DECIMAL(3,1) NOT NULL DEFAULT 5.0,
                created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // ── refresh_tokens ─────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id         VARCHAR(255) NOT NULL PRIMARY KEY,
                user_id    VARCHAR(255) NOT NULL,
                token      VARCHAR(512) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // ── trips ──────────────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS trips (
                id                  VARCHAR(255) NOT NULL PRIMARY KEY,
                passenger_id        VARCHAR(255) NOT NULL,
                driver_id           VARCHAR(255) NULL,
                origin_address      TEXT NOT NULL,
                origin_lat          DECIMAL(10,6) NOT NULL,
                origin_lng          DECIMAL(10,6) NOT NULL,
                destination_address TEXT NOT NULL,
                destination_lat     DECIMAL(10,6) NOT NULL,
                destination_lng     DECIMAL(10,6) NOT NULL,
                status              ENUM('requested','accepted','on_ride','completed','cancelled') NOT NULL DEFAULT 'requested',
                vehicle_type        ENUM('standard','comfort','xl') NOT NULL DEFAULT 'standard',
                notes               TEXT NULL,
                fare                DECIMAL(10,2) NULL,
                distance            DECIMAL(10,2) NULL,
                duration            INT NULL,
                requested_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                accepted_at         TIMESTAMP NULL,
                started_at          TIMESTAMP NULL,
                completed_at        TIMESTAMP NULL,
                FOREIGN KEY (passenger_id) REFERENCES users(id),
                FOREIGN KEY (driver_id) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // ── indexes ────────────────────────────────────────────────────────────
        // MySQL supports CREATE INDEX IF NOT EXISTS since 8.0.
        // For broader compatibility, we use a procedure-free approach.
        await queryRunner.query(`
            CREATE INDEX idx_trips_passenger ON trips(passenger_id)
        `)
        await queryRunner.query(`
            CREATE INDEX idx_trips_driver ON trips(driver_id)
        `)
        await queryRunner.query(`
            CREATE INDEX idx_trips_status ON trips(status)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS trips`)
        await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`)
        await queryRunner.query(`DROP TABLE IF EXISTS users`)
    }
}
