import { TestDatabase } from "./db/TestDatabase";

beforeAll(async () => {
    await TestDatabase.setup();
});

beforeEach(async () => {
    await TestDatabase.db.query("BEGIN");
})

afterEach(async () => {
    await TestDatabase.db.query("ROLLBACK");
})

afterAll(async () => {
    await TestDatabase.teardown();
})