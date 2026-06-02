/**
 * Standalone migration runner.
 * Run with: npm run migration:run
 * This connects to the database and runs all pending TypeORM migrations.
 */
import 'reflect-metadata'
import 'dotenv/config'
import { AppDataSource } from '../config/database'

async function run() {
    try {
        console.log('🔄 Connecting to database...')
        await AppDataSource.initialize()
        console.log('✅ Connected')

        console.log('🔄 Running pending migrations...')
        const migrations = await AppDataSource.runMigrations({ transaction: 'all' })
        
        if (migrations.length === 0) {
            console.log('✅ No pending migrations — database is up to date')
        } else {
            console.log(`✅ Ran ${migrations.length} migration(s):`)
            migrations.forEach(m => console.log(`   - ${m.name}`))
        }
    } catch (err) {
        console.error('❌ Migration failed:', err)
        process.exit(1)
    } finally {
        await AppDataSource.destroy()
        console.log('✅ Done')
        process.exit(0)
    }
}

run()
