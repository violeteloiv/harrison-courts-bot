import { CasesRepository } from "../../src/api/db/repos/cases";
import { FilingRepository } from "../../src/api/db/repos/filings";
import { UsersRepository } from "../../src/api/db/repos/users";
import { TestDatabase } from "../db/TestDatabase";

describe("CasesRepository", () => {
    let cases_repo: CasesRepository;
    let users_repo: UsersRepository;
    let filings_repo: FilingRepository;

    beforeEach(() => {
        cases_repo = new CasesRepository(TestDatabase.db);
        users_repo = new UsersRepository(TestDatabase.db);
        filings_repo = new FilingRepository(TestDatabase.db);
    });

    test("get_by_id populates parties and filings correctly", async () => {
        // Insert users for parties
        await users_repo.insert({
            discord_id: "1",
            roblox_id: "10",
            permission: 10,
            created: new Date(),
        });
        await users_repo.insert({
            discord_id: "2",
            roblox_id: "11",
            permission: 10,
            created: new Date(),
        });

        // Insert a case
        await cases_repo.insert({
            case_code: "C-123",
            judge: "1",
            card_link: "link",
            channel: "99",
            status: "open",
            parties: [
                { user_id: "1", role: "plaintiff" },
                { user_id: "2", role: "defendant" },
            ],
            filings: [], // we'll insert filings next
            created_at: new Date(),
            updated_at: new Date(),
        });

        // Insert a filing associated with the case
        await filings_repo.insert({
            filing_id: "F-456",
            case_code: "C-123",
            party: "plaintiff",
            filed_by: "1",
            types: [{ type: "motion" }],
            documents: [{ doc_link: "doc1" }],
            filed_at: new Date(),
        });

        // Fetch the case and check associations
        const case_ = await cases_repo.get_by_id("C-123");
        expect(case_).not.toBeNull();

        // Check parties
        expect(case_?.parties).toEqual([
            { user_id: "1", role: "plaintiff" },
            { user_id: "2", role: "defendant" },
        ]);

        // Check filings
        expect(case_?.filings).toEqual([{ filing_id: "F-456" }]);
    });
});