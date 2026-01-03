import { QueryResultRow } from "pg";
import { Repository } from "./repository";

export abstract class SingleRowRepository<T extends QueryResultRow> extends Repository<T> {
    async get(): Promise<T | null> {
        const result = await this.db.query<T>(
            `SELECT * FROM ${this.table} LIMIT 1`
        );
        return result.rows[0] ?? null;
    }

    async update_column<K extends keyof T>(column: K, value: T[K]): Promise<void> {
        const sql = `UPDATE ${this.table} SET ${String(column)} = $1`;
        await this.db.query(sql, [value]);
    }
}