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

    async file_query(file_path: string): Promise<void> {
        const absolute_path = path.resolve(file_path);
        const sql = await fs.readFile(absolute_path, "utf-8");
        await this._pool.query(sql);
    }
}