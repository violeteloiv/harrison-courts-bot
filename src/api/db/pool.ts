import { Pool } from "pg";

export const pool = new Pool({
    user: process.env.POSTGRES_USER ?? "violeteloiv",
    host: process.env.POSTGRES_HOST ?? "db",
    database: process.env.POSTGRES_DB ?? "courts_data",
    password: process.env.POSTGRES_PASSWORD ?? "psswrd",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
});

/**
 * Verifies the connection of the database.
 */
export async function db_verify_connection() {
    const client = await pool.connect();
    try {
        console.log("✅ Connected to PostgreSQL database");
    } finally {
        client.release();
    }
}