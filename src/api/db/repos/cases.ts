import { DatabaseClient } from "../client";
import { Repository } from "../repository";

export type Case = {
    case_code: string;
    judge: string;
    card_link: string;
    channel: string;
    status: string;
    plaintiffs: string[];
    defendants: string[];
    plaintiff_counsel: string[]
    defendant_counsel: string[];
    filings: string[];
}

export class CasesRepository extends Repository<Case> {
    constructor(db: DatabaseClient) {
        super(db, "cases", "case_code", [
            { table: "cases", foreign_key: "case_code", field_name: "plaintiffs", columns: ["plaintiffs"] },
            { table: "cases", foreign_key: "case_code", field_name: "defendants", columns: ["defendants"] },
            { table: "cases", foreign_key: "case_code", field_name: "plaintiff_counsel", columns: ["plaintiff_counsel"] },
            { table: "cases", foreign_key: "case_code", field_name: "defendant_counsel", columns: ["defendant_counsel"] },
            { table: "cases", foreign_key: "case_code", field_name: "filings", columns: ["filings"] }
        ]);
    }
}