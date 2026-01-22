import { Pool, QueryResult, QueryResultRow } from "pg";
import { pool } from "./pool";
import path from "path";
import fs from "fs/promises";

/**
 * The Database Client for interacting with the database via
 * the postgres API.
 */
export class DatabaseClient {
    /**
     * Creates a new DatabaseClient.
     * 
     * @param _pool A database pool tied to a particular
     * database instance.
     */
    constructor(private readonly _pool: Pool = pool) {}

    /**
     * Submits a query to the database.
     * 
     * @param sql The sql as a string.
     * @param params  Any paramaters needed in the query.
     * @returns A result to the particular query submitted.
     */
    async query<T extends QueryResultRow = any>(
        sql: string,
        params: any[] = []
    ): Promise<QueryResult<T>> {
        return this._pool.query<T>(sql, params);
    }

    /**
     * Submits a query to the database from a file.
     * 
     * @param file_path The file path of the sql.
     */
    async file_query(file_path: string): Promise<void> {
        const absolute_path = path.resolve(file_path);
        const sql = await fs.readFile(absolute_path, "utf-8");
        await this._pool.query(sql);
    }

    /**
     * Runs multiple queries inside a single transaction. Rolls back
     * if any query fails.
     * 
     * @param fn The function to execute
     * @returns The result of the transaction.
     */
    async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
        const client = await this._pool.connect();
        try {
            await client.query("BEGIN");
            const tx_client = new DatabaseClient({ query: client.query.bind(client) } as any);
            const result = await fn(tx_client);
            await client.query("COMMIT");
            return result;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }
}