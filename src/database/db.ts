import { Pool } from 'pg';

export const pool = new Pool({
    user: process.env.POSTGRES_USER || 'violeteloiv',
    host: 'db', // Service name in docker-compose.yml
    database: process.env.POSTGRES_DB || 'courts_data',
    password: process.env.POSTGRES_PASSWORD || 'psswrd',
    port: 5432,
});

export async function verifyConnection(): Promise<void> {
  try {
    // Attempt to acquire a client from the pool
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    client.release(); // Release the client back to the pool
  } catch (error) {
    console.error('❌ Error connecting to the database:', error);
  }
}