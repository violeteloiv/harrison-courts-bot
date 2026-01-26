import { DatabaseClient } from "../client";
import { Repository } from "../repository";
import { Case } from "./cases";

/**
 * The data type which encompasses the data of a filing.
 *
 * @remarks Filings is an "Association Repository" as the
 * types and documents are associated with other tables.
 */
export type Filing = {
    filing_id: string;
    case_code: string;
    party: string;
    filed_by: string;
    filed_at?: Date;

    types?: { type: string }[];
    documents?: { doc_link: string }[];
}

/**
 * Repository for interfacing with the `filings` table.
 *
 * @remarks
 * This repository models an *associations repository*. The table has two
 * "sub-tables" called associations which correlate to the types and documents
 * of the filings.
 *
 * This repository is only updated when a new filing is filed into the system
 * and is otherwise soley read only.
 *
 * @example
 * ```TS
 * const repo = new FilingsRepository(db);
 * const filing = await repo.get_by_id("F-ABCDEFGHIJLMNO");
 * console.log(filing.case_code);
 * ```
 */
export class FilingRepository extends Repository<Filing> {
    constructor(db: DatabaseClient) {
        super(db, "filings", "filing_id", [
            {
                table: "filing_types",
                foreign_key: "filing_id",
                field_name: "types",
                columns: ["type"],
            },
            {
                table: "filing_documents",
                foreign_key: "filing_id",
                field_name: "documents",
                columns: ["doc_link"],
            }
        ]);
    }

    async get_filings_for_case(court_case: Case): Promise<Filing[]> {
        return await this.find_all("case_code = $1", [court_case.case_code]);
    }
}
