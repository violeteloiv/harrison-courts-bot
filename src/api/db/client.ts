import { Pool, QueryResult, QueryResultRow } from "pg";
import { pool } from "./pool";

export class DatabaseClient {
    constructor(private readonly pool: Pool = pool) {}

    async query<T extends QueryResultRow = any>(
        sql: string,
        params: any[] = []
    ): Promise<QueryResult<T>> {
        return this.pool.query<T>(sql, params);
    }
}