import { DatabaseClient } from "../client";
import { Repository } from "../repository";

export type Filing = {
    filing_id: string;
    case_code: string;
    party: string;
    filed_by: string;
    filed_at?: Date;

    types?: { type: string }[];
    documents?: { doc_link: string }[];
}

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
}