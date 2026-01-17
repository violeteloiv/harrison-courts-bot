import { CaseCodesRepository } from "../../src/api/db/repos/case_codes";
import { TestDatabase } from "../db/TestDatabase";

describe("CaseCodesRepository.test.ts", () => {
    let case_codes_repo: CaseCodesRepository;

    beforeEach(() => {
        case_codes_repo = new CaseCodesRepository(TestDatabase.db);
    });

    test("get_code + increment_code", async () => {
        let initial_civil: number = await case_codes_repo.get_code("civil");
        expect(initial_civil).not.toBeNull();
        expect(initial_civil).toBe(1);

        await case_codes_repo.increment_code("civil");
        let final_value: number = await case_codes_repo.get_code("civil");
        expect(final_value).not.toBeNull();
        expect(final_value).not.toBe(1);
        expect(final_value).toBe(2);
    });

    test("existence of columns", async () => {
        let civil: number = await case_codes_repo.get_code("civil");
        expect(civil).not.toBeNull();
        let crim: number = await case_codes_repo.get_code("criminal");
        expect(crim).not.toBeNull();
        let admin: number = await case_codes_repo.get_code("admin");
        expect(admin).not.toBeNull();
        let limited: number = await case_codes_repo.get_code("limited");
        expect(limited).not.toBeNull();
        let duty: number = await case_codes_repo.get_code("duty_court");
        expect(duty).not.toBeNull();
    });
});