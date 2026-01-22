import { DatabaseClient } from "./client";
import { Migration } from "./migration";
import { migration as m001 } from "./migrations/001_init";

const migrations: Migration[] = [
    m001,
];

/**
 * Runs all of the defined migrations.
 * 
 * @param db The database to run the migrations on
 */
export async function db_run_migrations(db: DatabaseClient) {
    try {
        await db.query("BEGIN");

        await db.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id TEXT PRIMARY KEY,
                run_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );    
        `);

        const result = await db.query<{ id: string }>(
            `SELECT id FROM migrations`
        );
        const applied = new Set(result.rows.map(r => r.id));

        for (const migration of migrations) {
            if (applied.has(migration.id)) continue;

            console.log(`=> Running migration ${migration.id}`);
            await migration.up(db);

            await db.query(
                `INSERT INTO migrations (id) VALUES ($1)`,
                [migration.id]
            );
        }

        await db.query("COMMIT");
        console.log("Completed Migrations");
    } catch (err) {
        await db.query("ROLLBACK");
        console.error("Migration Failed: ", err);
        throw err;
    }
}