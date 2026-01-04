import { CasesRepository } from "../../src/api/db/repos/cases";
import { FilingRepository } from "../../src/api/db/repos/filings";
import { UsersRepository } from "../../src/api/db/repos/users";
import { TestDatabase } from "../db/TestDatabase";

describe("FilingsRepository", () => {
    let filings_repo: FilingRepository;
    let users_repo: UsersRepository;
    let cases_repo: CasesRepository;

    beforeEach(() => {
        filings_repo = new FilingRepository(TestDatabase.db);
        users_repo = new UsersRepository(TestDatabase.db);
        cases_repo = new CasesRepository(TestDatabase.db);
    });

    test("get_by_id populates filing associations correctly", async () => {
        // Insert user for 'filed_by'
        await users_repo.insert({
            discord_id: "3",
            roblox_id: "20",
            permission: 10,
            created: new Date(),
        });

        // Insert the case first to satisfy foreign key
        await cases_repo.insert({
            case_code: "C-123",
            judge: "3",
            card_link: "link",
            channel: "99",
            status: "open",
            parties: [],
            filings: [],
            created_at: new Date(),
            updated_at: new Date(),
        });

        // Insert filing with associations
        await filings_repo.insert({
            filing_id: "F-456",
            case_code: "C-123",
            party: "plaintiff",
            filed_by: "3",
            types: [{ type: "motion" }],
            documents: [{ doc_link: "doc1" }],
            filed_at: new Date(),
        });

        // Fetch the filing
        const filing = await filings_repo.get_by_id("F-456");

        expect(filing).not.toBeNull();
        expect(filing?.filing_id).toBe("F-456");
        expect(filing?.types).toEqual([{ type: "motion" }]);
        expect(filing?.documents).toEqual([{ doc_link: "doc1" }]);
    });
});