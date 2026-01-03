import { DatabaseClient } from "../client";
import { SingleRowRepository } from "../single_row_repository";

export type CaseCodes = {
    id: number;
    civil: number;
    criminal: number;
    expungement: number;
    special: number;
    appeal: number;
    admin: number;
    duty_court: number;
}

export class CaseCodesRepository extends SingleRowRepository<CaseCodes> {
    constructor(db: DatabaseClient) {
        super(db, "case_codes", "id", []);
    }
}