import { QueryResultRow } from "pg";
import { DatabaseClient } from "./client";
import { assert_identifier } from "./sql";

type Association<TMain, TChild extends QueryResultRow> = {
    table: string;
    foreign_key: keyof TChild;
    field_name: keyof TMain;
    columns: (keyof TChild)[];
    filter?: Partial<TChild>;
    repo?: Repository<TChild>;
}

export abstract class Repository<T extends QueryResultRow> {
    protected constructor(
        protected readonly db: DatabaseClient, 
        protected readonly table: string,
        protected primary_key: keyof T,
        protected associations: Association<T, any>[] = []
    ) {
        assert_identifier(table);
    }

    async get_by_id(id: any): Promise<T | null> {
        const main_result = await this.db.query<T>(
            `SELECT * FROM ${this.table} WHERE ${String(this.primary_key)} = $1`,
            [id]
        );
        const row = main_result.rows[0];
        if (!row) return null;

        for (const assoc of this.associations) {
            if (assoc.repo) {
                (row[assoc.field_name] as any) = await assoc.repo.find_all(
                    `${String(assoc.foreign_key)} = $1`,
                    [id]
                );
            } else {
                let sql = `SELECT ${assoc.columns.join(", ")} FROM ${assoc.table} WHERE ${String(assoc.foreign_key)} = $1`;
                const params: any[] = [id];

                if (assoc.filter) {
                    const filterClauses = Object.entries(assoc.filter).map(([k, v]) => {
                        params.push(v);
                        return `"${k}" = $${params.length}`;
                    });
                    sql += " AND " + filterClauses.join(" AND ");
                }

                const associated_result = await this.db.query(sql, params);
                
                (row[assoc.field_name] as any) = associated_result.rows;
            }
        }

        return row;
    }

    async insert(item: T) {
        const keys = Object.keys(item).filter(
            k => !this.associations.some(a => a.field_name === k)
        );
        
        const values = keys.map(k => {
            const val = item[k as keyof T];
            if (val === "" || val === undefined) return null;
            return val;
        });

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const sql = `INSERT INTO ${this.table} (${keys.join(", ")}) VALUES (${placeholders})`;
        await this.db.query(sql, values);

        for (const assoc of this.associations) {
            const child_items = item[assoc.field_name] as any[];
            if (!child_items || child_items.length === 0) continue;

            for (const child of child_items) {
                if (assoc.repo) {
                    await assoc.repo.insert(child);
                } else {
                    const columns = [assoc.foreign_key, ...assoc.columns];
                    const values = [item[this.primary_key], ...assoc.columns.map(c => child[c])];
                    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
                    const child_sql = `INSERT INTO ${assoc.table} (${columns.join(", ")}) VALUES (${placeholders})`;
                    await this.db.query(child_sql, values);
                }
            }
        }
    }

    async update(id: any, item: Partial<T>) {
        const keys = Object.keys(item).filter(k => !this.associations.some(a => a.field_name === k));
        if (keys.length === 0) return;

        const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
        const values = keys.map(k => item[k as keyof T]);
        const sql = `UPDATE ${this.table} SET ${setClause} WHERE ${String(this.primary_key)} = $${values.length + 1}`;
        await this.db.query(sql, [...values, id]);
    }

    async find_one(where: string, params: any[] = []): Promise<T | null> {
        const sql = `SELECT * FROM ${this.table} WHERE ${where} LIMIT 1`;
        const result = await this.db.query<T>(sql, params);
        return result.rows[0] ?? null;
    }

    async find_all(where?: string, params: any[] = []): Promise<T[]> {
        const sql = where ? `SELECT * FROM ${this.table} WHERE ${where}` : `SELECT * FROM ${this.table}`;
        const result = await this.db.query<T>(sql, params);
        return result.rows;
    }
}