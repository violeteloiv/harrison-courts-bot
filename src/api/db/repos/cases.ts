import { DatabaseClient } from "../client";
import { Repository } from "../repository";

export type CaseRole = "plaintiff" | "defendant" | "p_counsel" | "d_counsel";

export type Case = {
    case_code: string;
    judge: string;
    card_link: string;
    channel: string;
    status: string;
    created_at: Date;
    updated_at: Date;

    parties?: { user_id: string; role: CaseRole }[];
    filings?: { filing_id: string }[];
}

export class CasesRepository extends Repository<Case> {
    constructor(db: DatabaseClient) {
        super(db, "cases", "case_code");

        this.associations = [
            {
                table: "case_parties",
                foreign_key: "case_code",
                columns: ["user_id", "role"],
                field_name: "parties",
            },
            {
                table: "filings",
                foreign_key: "case_code",
                columns: ["filing_id"],
                field_name: "filings",
            }
        ];
    }
}