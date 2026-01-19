import { UsersRepository } from "../../src/api/db/repos/users";
import { TestDatabase } from "../db/TestDatabase";

describe("UsersRepository", () => {
    let repo: UsersRepository;
    beforeEach(() => {
        repo = new UsersRepository(TestDatabase.db);
    });

    test("insert + get_by_id", async () => {
        await repo.upsert({
            discord_id: "500",
            roblox_id: "200",
            permission: 100,
            created: new Date(),
        });

        const result = await repo.get_by_id("500");

        expect(result).not.toBeNull();
        expect(result?.discord_id).toBe("500");
        expect(result?.roblox_id).toBe("200");
        expect(result?.permission).toBe(100);
    });

    test("insert + update", async () => {
        await repo.upsert({
            discord_id: "500",
            roblox_id: "200",
            permission: 100,
            created: new Date(),
        });

        const initial_insertion = await repo.get_by_id("500");
        expect(initial_insertion).not.toBeNull();

        await repo.update("500", { permission: 200 });

        const final_update = await repo.get_by_id("500");
        expect(final_update).not.toBeNull();

        expect(initial_insertion?.permission).not.toBe(final_update?.permission);
        expect(final_update?.permission).toBe(200);
    });

    test("insert + find_one", async () => {
        await repo.upsert({
            discord_id: "500",
            roblox_id: "200",
            permission: 100,
            created: new Date(),
        });

        const insert_one = await repo.get_by_id("500");
        expect(insert_one).not.toBeNull();

        await repo.upsert({
            discord_id: "501",
            roblox_id: "201",
            permission: 100,
            created: new Date(),
        });

        const insert_two = await repo.get_by_id("501");
        expect(insert_two).not.toBeNull();

        const singlet = await repo.find_one("permission = 100");
        expect(singlet).not.toBeNull();
        expect(singlet?.permission).toBe(100);
    });

    test("insert + find_all", async () => {
        await repo.upsert({
            discord_id: "500",
            roblox_id: "200",
            permission: 100,
            created: new Date(),
        });

        const insert_one = await repo.get_by_id("500");
        expect(insert_one).not.toBeNull();

        await repo.upsert({
            discord_id: "501",
            roblox_id: "201",
            permission: 100,
            created: new Date(),
        });

        const insert_two = await repo.get_by_id("501");
        expect(insert_two).not.toBeNull();

        const all = await repo.find_all("permission = 100");
        expect(all).not.toBeNull();
        expect(all?.length).toBe(2);
        expect(all[0]?.permission).toBe(100);
        expect(all[1]?.permission).toBe(100);
    });
});