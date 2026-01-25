import { DatabaseClient } from "../client";
import { Repository } from "../repository";

/**
 * The particular roles that an individual can hold in a case.
 * 
 * @remarks You can either be a Plaintiff ("plaintiff"), Defendant ("defendant"),
 * Counsel to the Plaintiff ("p_counsel"), or Counsel to the Defendant ("d_counsel").
 */
export type CaseRole = "plaintiff" | "defendant" | "p_counsel" | "d_counsel";

export type CaseParty = {
  user_id: string | null;
  role: CaseRole;
  organization: string;
}

/**
 * The data type which encompasses the data of a case.
 * 
 * @remarks Case is an "Association Repository" as the
 * parties are associated with other tables.
 */
export type Case = {
    case_code: string;
    judge: string;
    card_link: string;
    channel: string;
    status: string;
    created_at?: Date;
    updated_at?: Date;

    parties?: CaseParty[];
}

/**
 * Repository for interfacing with the `cases` table.
 * 
 * @remarks
 * This repository models an *associations repository*. The table has two
 * "sub-tables" called associations which correlate to the parties
 * of the case.
 * 
 * This repository is only updated when a new case is filed into the system
 * and is otherwise soley read only.
 * 
 * @example
 * ```TS
 * const repo = new CasesRepository(db);
 * const case = await repo.get_by_id("HCV-0001-25");
 * console.log(case.channel);
 * ```
 */
export class CasesRepository extends Repository<Case> {
    /**
     * Creates a new CasesRepository.
     * 
     * @remarks The associations are created with the tables
     * `case_parties` which contains the discord_id and role of
     * the person, and the `filings` table which contains the filing
     * id of the particular filing.
     * 
     * @param db Database client used to execute queries.
     */
    constructor(db: DatabaseClient) {
        super(db, "cases", "case_code");

        this.associations = [
            {
                table: "case_parties",
                foreign_key: "case_code",
                columns: ["user_id", "role", "organization"],
                field_name: "parties",
            }
        ];
    }
}