import { Pool } from "pg";

export const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: Number(process.env.POSTGRES_PORT),
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
