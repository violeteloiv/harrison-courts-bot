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
        const result = await this.db.query<T>(
            `SELECT * FROM ${this.table} WHERE ${String(this.primary_key)} = $1`,
            [id]
        );

        const row = result.rows[0];
        if (!row) return null;
        if (this.associations.length === 0) {
            return row;
        }

        return this.hydrate(row);
    }

    /**
     * Upserts an item into the repository. An upsert is an insert if the
     * row doesn't already exist, and an update if it does!
     *
     * @param item The object to upsert into the repository
     */
    async upsert(item: T, tx?: DatabaseClient) {
        if (!tx) {
            await this.db.transaction(async inner => {
                await this.upsert(item, inner);
            });
            return;
        }

        const parent = await this.upsert_parent(item, tx);
        await this.persist_associations(parent, item, tx);
    }

    /**
     * Updates a partial section of a row.
     *
     * @param id The id of the object being updated
     * @param item A partial of the row we are updating
     */
    async update(id: any, item: Partial<T>, tx?: DatabaseClient) {
        if (!tx) {
            await this.db.transaction(async inner => {
                await this.update(id, item, inner);
            });
            return;
        }

        const keys = Object.keys(item).filter(
            k => !this.associations.some(a => a.field_name === k)
        );

        if (keys.length > 0) {
            const set_clause = keys
                .map((k, i) => `"${k}" = $${i + 1}`)
                .join(", ");

            const values = keys.map(k => item[k as keyof T]);

            const sql = `
                UPDATE ${this.table}
                SET ${set_clause}
                WHERE ${String(this.primary_key)} = $${values.length + 1}
                RETURNING *
            `;

            const result = await tx.query<T>(sql, [...values, id]);
            const parent = result.rows[0];

            if (!parent) return;
            await this.persist_associations(parent, item, tx);
        } else {
            const parent = { [this.primary_key]: id } as T;
            await this.persist_associations(parent, item, tx);
        }
    }

    /**
     * Finds one row of in the repository based on a specification
     *
     * @param where A where query in SQL
     * @param params Parameters for the where query
     * @returns The first row which specifies the query
     */
    async find_one(where: string, params: any[] = []): Promise<T | null> {
        const sql = `
            SELECT * FROM ${this.table}
            WHERE ${where}
            LIMIT 1
        `;

        const result = await this.db.query<T>(sql, params);
        const row = result.rows[0];

        if (!row) return null;
        if (this.associations.length === 0) {
            return row;
        }

        return this.hydrate(row);
    }

    /**
     * Finds all of the rows in a repository based on a specification
     *
     * @param where A where query in SQL
     * @param params Parameters for the where query
     * @returns The first row which specifies the query
     */
    async find_all(where?: string, params: any[] = []): Promise<T[]> {
        const sql = where
            ? `SELECT * FROM ${this.table} WHERE ${where}`
            : `SELECT * FROM ${this.table}`;

        const result = await this.db.query<T>(sql, params);
        if (this.associations.length === 0) {
            return result.rows;
        }

        return this.hydrate_many(result.rows);
    }

    /**
     * Hydrates association tables when updating, and hydrate client
     * data when retrieving information.
     *
     * @param row The row to hydrate
     * @returns The hydrated row
     */
    private async hydrate(row: T): Promise<T> {
        const id = row[this.primary_key];

        for (const assoc of this.associations) {
            if (assoc.repo) {
                row[assoc.field_name] = await assoc.repo.find_all(
                    `${String(assoc.foreign_key)} = $1`,
                    [id]
                ) as any;
            } else {
                let sql = `
                    SELECT ${assoc.columns.join(",")}
                    FROM ${assoc.table}
                    WHERE ${String(assoc.foreign_key)} = $1
                `;
                const params: any[] = [id];

                if (assoc.filter) {
                    const filters = Object.entries(assoc.filter).map(([k, v]) => {
                        params.push(v);
                        return `"${k}" = $${params.length}`;
                    });
                    sql += " AND " + filters.join(" AND ");
                }

                const result = await this.db.query(sql, params);
                row[assoc.field_name] = result.rows as any;
            }
        }

        return row;
    }

    /**
     * Hydrates multiple rows at once.
     *
     * @param rows The rows to hydrate
     * @returns The hydrated rows
     */
    private async hydrate_many(rows: T[]): Promise<T[]> {
        return Promise.all(rows.map(r => this.hydrate(r)));
    }

    /**
     * Ignore associations and upsert the canonical parent row
     *
     * @param item The item to update
     * @param db The database to work through
     * @returns The canonical parent row now updated
     */
    private async upsert_parent(
        item: T,
        db: DatabaseClient
    ): Promise<T> {
        const keys = Object.keys(item).filter(
            k => !this.associations.some(a => a.field_name === k)
        );

        const values = keys.map(k => {
            const v = item[k as keyof T];
            return v === "" || v === undefined ? null : v;
        });

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(",");

        const update_keys = keys.filter(k => k !== this.primary_key);
        const update_clause = update_keys
            .map(k => `${k} = EXCLUDED.${k}`)
            .join(",");

        const sql = `
            INSERT INTO ${this.table} (${keys.join(",")})
            VALUES (${placeholders})
            ON CONFLICT (${String(this.primary_key)})
            DO UPDATE SET ${update_clause}
            RETURNING *
        `;

        const result = await db.query<T>(sql, values);
        return result.rows[0];
    }

    /**
     * Persists the associations of a parent.
     *
     * @param parent The parent to persist associations to
     * @param input The input
     * @param db The database we are wortking on
     */
    private async persist_associations(
        parent: T,
        input: Partial<T>,
        db: DatabaseClient
    ) {
        const parent_id = parent[this.primary_key];

        for (const assoc of this.associations) {
            const children = input[assoc.field_name] as any[] | undefined;
            if (!children) continue;

            for (const child of children) {
                child[assoc.foreign_key] = parent_id;

                if (assoc.repo) {
                    await assoc.repo.upsert(child, db);
                } else {
                    const columns = [assoc.foreign_key, ...assoc.columns];
                    const values = columns.map(c => child[c]);
                    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

                    const sql = `
                        INSERT INTO ${assoc.table} (${columns.join(",")})
                        VALUES (${placeholders})
                        ON CONFLICT DO NOTHING
                    `;

                    await db.query(sql, values);
                }
            }
        }
    }
}
