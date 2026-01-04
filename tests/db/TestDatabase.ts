import { Pool } from "pg";
import { DatabaseClient } from "../../src/api/db/client";
import { db_run_migrations } from "../../src/api/db/migrate";

export class TestDatabase {
    private static pool: Pool;
    static db: DatabaseClient;

    static async setup() {
        this.pool = new Pool({
            host: "localhost",
            user: "violeteloiv",
            password: "psswrd",
            database: "courts_test",
            port: 5432
        });

        this.db = new DatabaseClient(this.pool);

        // Ensure a clean schema
        await this.reset();
        // Run migrations
        await db_run_migrations(this.db);
    }

    static async reset() {
        await this.pool.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        `);
    }

    static async teardown() {
        await this.pool.end();
    }
}