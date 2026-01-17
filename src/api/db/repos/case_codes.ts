import { DatabaseClient } from "../client";
import { SingleRowRepository } from "../single_row_repository";

/**
 * Represents the numeric case code values used to identify
 * different categories of court cases.
 * 
 * @remarks
 * This table is expected to contain exactly one row. Each
 * field corresponds to a distinct case category and maps to
 * an external or jurisdiction-defined code.
 */
export type CaseCodes = {
    /** Primary key for the case_codes table. */
    id: number;
    /** Code for civil cases. */
    civil: number;
    /** Code for criminal cases. */
    criminal: number;
    /** Code for limited matter cases. */
    limited: number;
    /** Code for administrative cases. */
    admin: number;
    /** Code for duty court proceedings. */
    duty_court: number;
}

/**
 * A type which represents the case codes which are incrementable.
 * 
 * @remarks
 * This only excludes the id as the primary key should not be
 * incrementable by the user.
 */
type IncrementableCaseCodes = Exclude<keyof CaseCodes, "id">;

/**
 * Repository for interfacing with the `case_codes` table.
 * 
 * @remarks
 * This repository models a *single-row configuration table*. The
 * table is assumed to contain exactly one row that defines the numeric
 * codes for each case type.
 * 
 * This repository is only updated when a new case is filed into the system
 * and is otherwise soley read only.
 * 
 * @example
 * ```TS
 * const repo = new CaseCodesRepository(db);
 * const codes = await repo.get();
 * console.log(codes.civil);
 * ```
 */
export class CaseCodesRepository extends SingleRowRepository<CaseCodes> {
    /**
     * Creates a new CaseCodesRepository.
     * 
     * @param db - Database client used to execute queries. 
     */
    constructor(db: DatabaseClient) {
        super(db, "case_codes", "id", []);
    }

    /**
     * Retrieves a specific case code by category.
     * 
     * @param key - The case category to retrieve.
     * @returns The numeric code associated with the category.
     */
    async get_code<K extends keyof CaseCodes>(key: K): Promise<CaseCodes[K]> {
        const row = await this.get();
        if (!row) {
            throw new Error("ERROR: Case Codes Not Found.");
        }
        return row[key];
    }

    /**
     * Increments and retrieves the case code by category.
     * 
     * @remarks
     * This operation is safe under concurrent access and assumes the
     * underlying table contains exactly one row.
     * 
     * @param key - The case code category to increment.
     * @returns The updated
     */
    async increment_code<K extends IncrementableCaseCodes>(key: K): Promise<CaseCodes[K]> {
        const column = key as string;
        const value = await this.get_code(column as IncrementableCaseCodes);

        const result = await this.db.query<Pick<CaseCodes, K>>(
            `
            UPDATE ${this.table}
            SET ${column} = ${value} + 1
            RETURNING ${column};
            `
        );

        if (result.rowCount !== 1) {
            throw new Error("ERROR: Failed To Increment Case Code.");
        }

        return result.rows[0][key];
    }
}