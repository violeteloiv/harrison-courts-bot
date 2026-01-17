import { QueryResultRow } from "pg";
import { DatabaseClient } from "./client";
import { assert_identifier } from "./sql";

/**
 * An Association is a relationship between a table and another
 * table. It requires you to identify a 'foreign_key' which tells
 * you how to identify items in the table with another row.
 */
type Association<TMain, TChild extends QueryResultRow> = {
    table: string;
    foreign_key: keyof TChild;
    field_name: keyof TMain;
    columns: (keyof TChild)[];
    filter?: Partial<TChild>;
    repo?: Repository<TChild>;
}

/**
 * A Repository is an abstract representation of a database table
 * which defines the means of interacting with the database
 * without expressly dealing with queries.
 */
export abstract class Repository<T extends QueryResultRow> {
    /**
     * Creates a new Repository.
     * 
     * @param db The client we communicate with the database through
     * @param table The table we are representing
     * @param primary_key The primary key of the table
     * @param associations A list of associations if needed
     */
    protected constructor(
        protected readonly db: DatabaseClient, 
        protected readonly table: string,
        protected primary_key: keyof T,
        protected associations: Association<T, any>[] = []
    ) {
        assert_identifier(table);
        assert_identifier(primary_key as string);
        associations.forEach((association) => {
            assert_identifier(association.table);
            assert_identifier(association.foreign_key as string);
            association.columns.forEach((column) => {
                assert_identifier(column as string);
            });
        });
    }

    /**
     * Gets a row (or null if it doesn't exist) of the repository
     * based on the primary_key or some other id.
     * 
     * @param id The id of the row we are looking for
     * @returns The row we return, or null otherwise
     */
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

    /**
     * Upserts an item into the repository. An upsert is an insert if the
     * row doesn't already exist, and an update if it does!
     * 
     * @param item The object to upsert into the repository
     */
    async upsert(item: T) {
        const keys = Object.keys(item).filter(
            k => !this.associations.some(a => a.field_name === k)
        );
        
        const values = keys.map(k => {
            const val = item[k as keyof T];
            if (val === "" || val === undefined) return null;
            return val;
        });

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

        // Columns to update on conflict (excluding primary key)
        const update_keys = keys.filter(k => k !== this.primary_key);
        const update_clause = update_keys
            .map((k, i) => `${k} = EXCLUDED.${k}`)
            .join(", ");


        const sql = `
            INSERT INTO ${this.table} (${keys.join(", ")})
            VALUES (${placeholders})
            ON CONFLICT (${String(this.primary_key)})
            DO UPDATE SET ${update_clause}
            RETURNING *;
        `;

        await this.db.query(sql, values);

        for (const assoc of this.associations) {
            const child_items = item[assoc.field_name] as any[];
            if (!child_items || child_items.length === 0) continue;

            for (const child of child_items) {
                if (assoc.repo) {
                    await assoc.repo.upsert(child);
                } else {
                    const columns = [assoc.foreign_key, ...assoc.columns];
                    const child_values = [item[this.primary_key], ...assoc.columns.map(c => child[c])];
                    const child_placeholders = child_values.map((_, i) => `$${i + 1}`).join(", ");
                    const child_sql = `
                        INSERT INTO ${assoc.table} (${columns.join(", ")}) 
                        VALUES (${child_placeholders})
                    `;
                    await this.db.query(child_sql, child_values);
                }
            }
        }
    }

    /**
     * Updates a partial section of a row.
     * 
     * @param id The id of the object being updated
     * @param item A partial of the row we are updating
     */
    async update(id: any, item: Partial<T>) {
        const keys = Object.keys(item).filter(k => !this.associations.some(a => a.field_name === k));
        if (keys.length === 0) return;

        const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
        const values = keys.map(k => item[k as keyof T]);
        const sql = `UPDATE ${this.table} SET ${setClause} WHERE ${String(this.primary_key)} = $${values.length + 1}`;
        await this.db.query(sql, [...values, id]);
    }

    /**
     * Finds one row of in the repository based on a specification
     * 
     * @param where A where query in SQL
     * @param params Parameters for the where query
     * @returns The first row which specifies the query
     */
    async find_one(where: string, params: any[] = []): Promise<T | null> {
        const sql = `SELECT * FROM ${this.table} WHERE ${where} LIMIT 1`;
        const result = await this.db.query<T>(sql, params);
        return result.rows[0] ?? null;
    }

    /**
     * Finds all of the rows in a repository based on a specification
     * 
     * @param where A where query in SQL
     * @param params Parameters for the where query
     * @returns The first row which specifies the query
     */
    async find_all(where?: string, params: any[] = []): Promise<T[]> {
        const sql = where ? `SELECT * FROM ${this.table} WHERE ${where}` : `SELECT * FROM ${this.table}`;
        const result = await this.db.query<T>(sql, params);
        return result.rows;
    }
}